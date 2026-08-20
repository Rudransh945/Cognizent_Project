"""LangGraph orchestration for ProductGenie's conversational workflows."""

import base64
import re
from typing import Annotated, Literal, TypedDict

import pdfplumber
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel

from database import get_history, save_message
from models import Product
from services import compact_products, product_from_pdf_text, search_shopping, vector_store
from settings import GROQ_API_KEY, TEXT_MODEL, VISION_MODEL


SYSTEM_PROMPT = """You are ProductGenie: a warm, decisive shopping companion, not a report writer.

Use ONLY supplied product facts. Never infer typical specs, expected performance, brand reputation, or prices. Do not use “likely”, “typically”, “often”, or claims about what a product line is known for. If a fact is missing, say it is unconfirmed.

Reply in 70–130 words. Do not use markdown tables, headings, long checklists, or preambles. Use this natural format:
• Start with “My pick: [product] — [price] ([source]).” and give one evidence-based reason.
• Mention up to two alternatives with a clear trade-off each.
• Add one brief “Check before buying” note only when a decision-critical fact is unavailable.
• End with exactly one friendly, relevant question that helps narrow the choice (for example, workload, family size, preferred type, portability, or a priority).

If the user asks a follow-up, answer it directly using products already in the session, then ask one useful next question. Keep the tone conversational, confident, and practical."""


class GraphState(TypedDict, total=False):
    """State carried between intent, tool, retrieval, and response nodes."""

    session_id: str
    user_query: str
    intent: Literal["search", "compare", "photo", "pdf", "followup"]
    chat_history: list[dict]
    products: list[Product]
    response: str
    pdf_text: str
    image_bytes: bytes
    image_mime_type: str


class IntentClassification(BaseModel):
    """Schema returned by Groq for selecting a LangGraph route."""

    intent: Literal["search", "compare", "photo", "pdf", "followup"]


class ProductExtraction(BaseModel):
    """Structured, source-preserving product extraction result from Groq."""

    products: list[Product]


def _llm(model: str = TEXT_MODEL) -> ChatGroq:
    """Create the Groq LangChain chat client for a configured model."""
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured.")
    return ChatGroq(api_key=GROQ_API_KEY, model=model, temperature=0.2, timeout=45, max_retries=1)


def classify_intent_node(state: GraphState) -> dict:
    """Classify the request with Groq, falling back to deterministic routing if unavailable."""
    query = state["user_query"].lower()
    if state.get("image_bytes"):
        intent = "photo"
    elif state.get("pdf_text"):
        intent = "pdf"
    elif any(word in query for word in ("compare", "versus", " vs ", "difference", "which one")):
        intent = "compare"
    elif any(word in query for word in ("what if", "instead", "battery", "more important", "cheaper", "follow")):
        intent = "followup"
    else:
        intent = "search"
    if GROQ_API_KEY and not state.get("image_bytes") and not state.get("pdf_text"):
        try:
            classifier = _llm().with_structured_output(IntentClassification)
            result = classifier.invoke([
                SystemMessage(content="Classify the request as exactly one of search, compare, photo, pdf, followup. Search means discovering products; compare means evaluating already seen products; followup adds a constraint."),
                HumanMessage(content=state["user_query"]),
            ])
            intent = result.intent
        except Exception:
            # The graph can still route clear requests when a provider is temporarily unavailable.
            pass
    return {"intent": intent}


def load_chat_history_node(state: GraphState) -> dict:
    """Load persisted messages to give follow-up replies full session context."""
    return {"chat_history": get_history(state["session_id"])}


def vision_identify_node(state: GraphState) -> dict:
    """Use Groq vision to identify a pictured product and turn it into a shopping query."""
    encoded = base64.b64encode(state["image_bytes"]).decode("ascii")
    mime_type = state.get("image_mime_type", "image/jpeg")
    message = HumanMessage(content=[
        {"type": "text", "text": "Classify the largest central object into the safest common shopping category. Reply with ONLY a 2–4 word shopping phrase: for example 'office chair', 'dining chair', 'gaming chair', 'wireless headphones', or 'front load washing machine'. Do not describe the scene, guess a brand/model, add an explanation, or use punctuation. A seat with a backrest, legs, armrests, or caster wheels is a chair/furniture item—not an appliance. Only call something an appliance when controls, a door, vents, or a power connection are visibly clear. If unsure, use the broadest safe category."},
        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{encoded}"}},
    ])
    identification = _llm(VISION_MODEL).invoke([message]).content
    # Serper Shopping requires a compact plain-text query. Vision responses can
    # otherwise contain formatting or multi-line descriptions that it rejects.
    search_query = re.sub(r"[^A-Za-z0-9 .&+_-]", " ", str(identification))
    search_query = re.sub(r"\s+", " ", search_query).strip()[:120]
    if not search_query:
        search_query = "product shown in photo"
    return {"user_query": search_query, "response": f"I identified this as: {search_query}"}


def live_search_node(state: GraphState) -> dict:
    """Run the Serper India Shopping search for the current query or vision identification."""
    return {"products": search_shopping(state["user_query"])}


def parse_pdf_node(state: GraphState) -> dict:
    """Convert supplied PDF text into one conservative product record for comparison."""
    product = product_from_pdf_text(state.get("pdf_text", ""))
    return {"products": [product]}


def extract_specs_node(state: GraphState) -> dict:
    """Use Groq to structure explicit title/PDF facts while preserving a safe local fallback."""
    products = state.get("products", [])
    if not products or not GROQ_API_KEY:
        return {"products": products}
    try:
        extracted = _llm().with_structured_output(ProductExtraction).invoke([
            SystemMessage(content="Convert only explicitly present product facts into the supplied schema. Keep all product count, source and links. Never infer missing specifications or prices; use empty specs and 'Price unavailable' where facts are absent."),
            HumanMessage(content=f"Source product records:\n{compact_products(products)}"),
        ]).products
        if len(extracted) == len(products):
            return {"products": extracted}
    except Exception:
        pass
    return {"products": products}


def embed_and_store_node(state: GraphState) -> dict:
    """Embed current products using MiniLM and append them to the session FAISS index."""
    vector_store.add(state["session_id"], state.get("products", []))
    return {}


def retrieve_products_node(state: GraphState) -> dict:
    """Retrieve relevant previously seen products from the per-session semantic index."""
    products = vector_store.search(state["session_id"], state["user_query"])
    return {"products": products}


def rerank_node(state: GraphState) -> dict:
    """Retrieve session products again after a new preference constraint is expressed."""
    products = vector_store.search(state["session_id"], state["user_query"])
    return {"products": products or state.get("products", [])}


def compare_node(state: GraphState) -> dict:
    """Mark the first retrieved product as a candidate recommendation before explanation."""
    products = state.get("products", [])
    if products:
        products[0].recommended = True
    return {"products": products}


def respond_node(state: GraphState) -> dict:
    """Generate a grounded natural-language response from products and persisted context."""
    products = state.get("products", [])
    if not products:
        return {"response": "I don't have enough product data in this session yet. Try a product search or upload a spec sheet."}
    history = "\n".join(f"{m['role']}: {m['content']}" for m in state.get("chat_history", [])[-8:])
    prompt = f"User request: {state['user_query']}\nHistory:\n{history}\nTrusted product data:\n{compact_products(products)}"
    answer = _llm().invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)]).content
    return {"response": str(answer)}


def save_to_sqlite_node(state: GraphState) -> dict:
    """Persist the user query and graph-generated assistant response at the end of every turn."""
    save_message(state["session_id"], "user", state["user_query"])
    save_message(state["session_id"], "assistant", state.get("response", ""))
    return {}


def _route_after_intent(state: GraphState) -> str:
    """Return the next node name corresponding to the classified intent."""
    return state["intent"]


def build_graph():
    """Build and compile the ProductGenie LangGraph state machine."""
    flow = StateGraph(GraphState)
    flow.add_node("classify_intent", classify_intent_node)
    flow.add_node("load_chat_history", load_chat_history_node)
    flow.add_node("vision_identify", vision_identify_node)
    flow.add_node("live_search", live_search_node)
    flow.add_node("parse_pdf", parse_pdf_node)
    flow.add_node("extract_specs", extract_specs_node)
    flow.add_node("embed_and_store", embed_and_store_node)
    flow.add_node("retrieve_products", retrieve_products_node)
    flow.add_node("rerank", rerank_node)
    flow.add_node("compare", compare_node)
    flow.add_node("respond", respond_node)
    flow.add_node("save_to_sqlite", save_to_sqlite_node)
    flow.add_edge(START, "classify_intent")
    flow.add_conditional_edges("classify_intent", _route_after_intent, {
        "search": "live_search", "compare": "retrieve_products", "photo": "vision_identify", "pdf": "parse_pdf", "followup": "load_chat_history",
    })
    flow.add_edge("vision_identify", "live_search")
    flow.add_edge("live_search", "extract_specs")
    flow.add_edge("parse_pdf", "extract_specs")
    flow.add_edge("extract_specs", "embed_and_store")
    flow.add_edge("embed_and_store", "respond")
    flow.add_edge("retrieve_products", "compare")
    flow.add_edge("compare", "respond")
    flow.add_edge("load_chat_history", "rerank")
    flow.add_edge("rerank", "respond")
    flow.add_edge("respond", "save_to_sqlite")
    flow.add_edge("save_to_sqlite", END)
    return flow.compile()

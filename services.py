"""External-tool adapters plus local semantic product retrieval."""

import asyncio
import json
import re
from typing import Any

import faiss
import httpx
import requests
from bs4 import BeautifulSoup
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from sentence_transformers import SentenceTransformer

from database import get_products as get_stored_products
from database import save_products
from models import Product
from settings import GROQ_API_KEY, SERPER_API_KEY, TEXT_MODEL


class ProductVectorStore:
    """Per-session FAISS indexes backed by CPU MiniLM embeddings."""

    def __init__(self) -> None:
        """Set up lazy embedding state so API startup remains quick."""
        self._model: SentenceTransformer | None = None
        self._indexes: dict[str, faiss.IndexFlatIP] = {}
        self._products: dict[str, list[Product]] = {}

    def _embedder(self) -> SentenceTransformer:
        """Load all-MiniLM-L6-v2 only when a product needs indexing."""
        if self._model is None:
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
        return self._model

    @staticmethod
    def _product_text(product: Product) -> str:
        """Convert product fields to searchable semantic text."""
        fields = [product.name, product.brand, product.price, product.description, product.offers]
        if product.rating is not None:
            fields.append(f"rating {product.rating}")
        if product.delivery:
            fields.append(product.delivery)
        fields.extend(f"{key} {value}" for key, value in product.specs.items())
        return " ".join(str(value).strip() for value in fields if value is not None and str(value).strip())

    def _load_session(self, session_id: str) -> None:
        """Rebuild a session index after an API restart from its stored evidence."""
        if session_id in self._products:
            return
        stored = []
        for record in get_stored_products(session_id):
            try:
                stored.append(Product.model_validate(record))
            except Exception:
                continue
        # Mark the session as loaded before calling add(), otherwise add() would
        # try to hydrate the same session recursively.
        self._products[session_id] = []
        if stored:
            self.add(session_id, stored, persist=False)

    def add(self, session_id: str, products: list[Product], *, persist: bool = True) -> None:
        """Embed and append products to one session's FAISS inner-product index."""
        self._load_session(session_id)
        seen = {(product.name, product.link) for product in self._products.get(session_id, [])}
        new_products: list[Product] = []
        for product in products:
            key = (product.name, product.link)
            if key in seen:
                continue
            seen.add(key)
            new_products.append(product)
        if not new_products:
            return
        embeddings = self._embedder().encode([self._product_text(product) for product in new_products], normalize_embeddings=True)
        index = self._indexes.setdefault(session_id, faiss.IndexFlatIP(embeddings.shape[1]))
        index.add(embeddings.astype("float32"))
        self._products.setdefault(session_id, []).extend(new_products)
        if persist:
            save_products(session_id, [product.model_dump() for product in new_products])

    def search(self, session_id: str, query: str, limit: int = 6) -> list[Product]:
        """Retrieve the session products semantically closest to a query."""
        self._load_session(session_id)
        index = self._indexes.get(session_id)
        products = self._products.get(session_id, [])
        if index is None or not products:
            return []
        vector = self._embedder().encode([query], normalize_embeddings=True).astype("float32")
        _, ids = index.search(vector, min(limit, len(products)))
        return [products[i] for i in ids[0] if i >= 0]

    def selected(self, session_id: str, requested: list[Product]) -> list[Product]:
        """Return client-selected listings only when they match trusted session records."""
        self._load_session(session_id)
        trusted = self._products.get(session_id, [])
        chosen: list[Product] = []
        seen: set[tuple[str, str, str, str]] = set()
        for product in requested:
            key = (product.name, product.price, product.source, product.link)
            if key in seen:
                continue
            match = next(
                (item for item in trusted if (item.name, item.price, item.source, item.link) == key),
                None,
            )
            if match:
                chosen.append(match)
                seen.add(key)
        return chosen

    def named(self, session_id: str, query: str) -> list[Product]:
        """Find a listing explicitly named in a follow-up without semantic guesswork."""
        self._load_session(session_id)
        normalized_query = re.sub(r"[^a-z0-9]+", " ", query.lower()).strip()
        if len(normalized_query) < 8:
            return []
        matches = []
        for product in self._products.get(session_id, []):
            normalized_name = re.sub(r"[^a-z0-9]+", " ", product.name.lower()).strip()
            # The full listing title may appear in a question, or a user may type
            # a distinctive title fragment such as "Mistborn Book 1".
            if len(normalized_name) >= 8 and (
                normalized_name in normalized_query or normalized_query in normalized_name
            ):
                matches.append(product)
        return matches


vector_store = ProductVectorStore()


def _string_value(value: Any) -> str:
    """Flatten a small structured-data value without fabricating any content."""
    if isinstance(value, dict):
        # Schema.org commonly represents brand and named values as an object;
        # its type label is metadata, not part of the user-facing value.
        for preferred_key in ("name", "value"):
            preferred = _string_value(value.get(preferred_key))
            if preferred:
                return preferred
        values = [_string_value(item) for item in value.values()]
        return ", ".join(item for item in values if item)
    if isinstance(value, list):
        values = [_string_value(item) for item in value]
        return ", ".join(item for item in values if item)
    return str(value).strip() if value is not None else ""


def _listing_specs(item: dict[str, Any]) -> dict[str, str]:
    """Keep useful non-price facts Serper includes, including undocumented extensions."""
    specs: dict[str, str] = {}
    labels = {
        "condition": "Condition",
        "availability": "Availability",
        "seller": "Seller",
        "merchant": "Merchant",
        "color": "Colour",
        "size": "Size",
    }
    for field, label in labels.items():
        value = _string_value(item.get(field))
        if value:
            specs[label] = value[:180]
    for container in (item.get("specs"), item.get("specifications"), item.get("extensions")):
        if isinstance(container, dict):
            pairs = container.items()
        elif isinstance(container, list):
            pairs = ((f"Listing detail {index + 1}", value) for index, value in enumerate(container))
        else:
            continue
        for key, value in pairs:
            clean_key, clean_value = str(key).strip(), _string_value(value)
            if clean_key and clean_value:
                specs[clean_key[:80]] = clean_value[:180]
    return specs


def search_shopping(query: str) -> list[Product]:
    """Fetch India-localized Serper Shopping listings and normalize them as products."""
    if not SERPER_API_KEY:
        raise RuntimeError("SERPER_API_KEY is not configured.")
    try:
        response = requests.post(
            "https://google.serper.dev/shopping",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "gl": "in", "hl": "en"},
            timeout=20,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError("Live product search is temporarily unavailable. Please try again shortly.") from exc
    raw_items = response.json().get("shopping", [])
    products: list[Product] = []
    for item in raw_items[:8]:
        title = item.get("title", "Unnamed product")
        products.append(Product(
            name=title,
            brand=title.split()[0] if title else "Unknown",
            price=item.get("price", "Price unavailable"),
            specs=_listing_specs(item),
            imageUrl=item.get("imageUrl", item.get("image", "")),
            source=item.get("source", "Search result"),
            link=item.get("link", ""),
            rating=item.get("rating", None),
            rating_count=item.get("ratingCount", None),
            delivery=item.get("delivery", ""),
            offers=item.get("offers", ""),
            product_id=str(item.get("productId", "")),
            position=item.get("position"),
        ))
    return products


def _json_ld_products(value: Any) -> list[dict[str, Any]]:
    """Return Product objects nested anywhere in a JSON-LD payload."""
    if isinstance(value, list):
        return [product for item in value for product in _json_ld_products(item)]
    if not isinstance(value, dict):
        return []
    types = value.get("@type", [])
    if isinstance(types, str):
        types = [types]
    found = [value] if any(str(item).lower() == "product" for item in types) else []
    for nested in value.values():
        found.extend(_json_ld_products(nested))
    return found


def _structured_specs(soup: BeautifulSoup) -> tuple[dict[str, str], str]:
    """Read explicit retailer/manufacturer JSON-LD Product fields from a listing page."""
    specs: dict[str, str] = {}
    brand = ""
    fields = {
        "model": "Model", "sku": "SKU", "mpn": "MPN", "color": "Colour", "size": "Size",
        "material": "Material", "weight": "Weight", "dimensions": "Dimensions", "category": "Category",
    }
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            payload = json.loads(script.string or script.get_text())
        except (TypeError, json.JSONDecodeError):
            continue
        for product in _json_ld_products(payload):
            if not brand:
                brand = _string_value(product.get("brand"))
            for field, label in fields.items():
                value = _string_value(product.get(field))
                if value:
                    specs[label] = value[:180]
            properties = product.get("additionalProperty", [])
            if isinstance(properties, dict):
                properties = [properties]
            for prop in properties:
                if not isinstance(prop, dict):
                    continue
                key = _string_value(prop.get("name") or prop.get("propertyID"))
                value = _string_value(prop.get("value"))
                if key and value:
                    specs[key[:80]] = value[:180]
    return specs, brand


async def scrape_page_details(url: str) -> dict[str, Any]:
    """Extract explicit page description, JSON-LD specs, and Open Graph image."""
    if not url:
        return {}
    try:
        async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "ProductGenie/1.0"}) as client:
            html = (await client.get(url)).text
        soup = BeautifulSoup(html, "html.parser")
        description = soup.find("meta", attrs={"name": "description"})
        og_image = soup.find("meta", property="og:image")
        specs, brand = _structured_specs(soup)
        return {
            "description": description.get("content", "") if description else "",
            "imageUrl": og_image.get("content", "") if og_image else "",
            "specs": specs,
            "brand": brand,
        }
    except httpx.RequestError:
        return {}


async def search_product_details(name: str) -> str:
    """Collect specification evidence from Serper Search snippets for one exact listing title."""
    if not name or not SERPER_API_KEY:
        return ""
    try:
        async with httpx.AsyncClient(timeout=20, headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"}) as client:
            response = await client.post(
                "https://google.serper.dev/search",
                json={"q": f'"{name}" specifications', "gl": "in", "hl": "en", "num": 10},
            )
            response.raise_for_status()
        results = response.json().get("organic", [])
        evidence = []
        for result in results[:5]:
            title = str(result.get("title", "")).strip()
            snippet = str(result.get("snippet", "")).strip()
            if snippet:
                evidence.append(f"Result title: {title}\nDetails: {snippet}" if title else snippet)
        return "\n".join(evidence)
    except httpx.HTTPError:
        return ""


def extract_specs_from_text(text: str) -> dict[str, str]:
    """Extract explicitly stated, category-appropriate specifications from page text."""
    if not text.strip() or not GROQ_API_KEY:
        return {}
    try:
        response = ChatGroq(
            api_key=GROQ_API_KEY,
            model=TEXT_MODEL,
            temperature=0.2,
            timeout=45,
            max_retries=1,
        ).invoke([
            SystemMessage(content="Extract only specifications explicitly stated for the exact product title in the supplied evidence. Search snippets can describe closely related variants, so omit any field with conflicting values or no clear connection to that exact title. Return ONLY a JSON object whose keys and values are the supported specifications found. Infer the relevant keys from the text; do not use a fixed schema, infer missing facts, or include commentary."),
            HumanMessage(content=text),
        ])
        content = str(response.content).strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content).strip()
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            return {}
        return {
            str(key): str(value)
            for key, value in parsed.items()
            if isinstance(key, str) and value is not None and str(value).strip()
        }
    except Exception:
        return {}


async def enrich_products(products: list[Product]) -> list[Product]:
    """Add source-backed details to every Serper candidate, not just the first two."""
    page_details, search_details = await asyncio.gather(
        asyncio.gather(*(scrape_page_details(product.link) for product in products)),
        asyncio.gather(*(search_product_details(product.name) for product in products)),
    )
    for product, page_detail, search_detail in zip(products, page_details, search_details):
        page_description = page_detail.get("description", "").strip()
        image_url = page_detail.get("imageUrl", "").strip()
        evidence = "\n\n".join(part for part in (f"Exact product title: {product.name}", page_description, search_detail) if part)
        if evidence:
            product.description = evidence
        structured_specs = page_detail.get("specs", {})
        if isinstance(structured_specs, dict):
            product.specs = {**product.specs, **structured_specs}
        if product.brand == "Unknown" and page_detail.get("brand"):
            product.brand = str(page_detail["brand"])
        if not product.imageUrl and image_url:
            product.imageUrl = image_url
    return products


def product_from_pdf_text(raw_text: str) -> Product:
    """Build a conservative local product record from extracted PDF text without inventing values."""
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    name = lines[0][:120] if lines else "Uploaded specification sheet"
    specs: dict[str, str] = {}
    for line in lines[:80]:
        match = re.match(r"^([A-Za-z][A-Za-z0-9 /_-]{1,40})\s*[:\-]\s*(.{1,120})$", line)
        if match:
            specs[match.group(1).strip()] = match.group(2).strip()
    return Product(name=name, specs=specs, source="Uploaded PDF")


def compact_products(products: list[Product]) -> str:
    """Serialize trusted product facts for a grounded LLM prompt."""
    return json.dumps([product.model_dump() for product in products], ensure_ascii=False)

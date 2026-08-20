# ProductGenie architecture

## State

Every LangGraph turn carries `session_id`, `user_query`, `intent`, `chat_history`, `products`, and `response`. Upload paths additionally carry transient `image_bytes` or `pdf_text`. Product records are normalized as `name`, `brand`, `price`, `specs`, `imageUrl`, `source`, and `link`.

## Intent-routing graph

```text
START
  │
  ▼
classify_intent
  ├─ search ───► live_search (Serper /shopping; gl=in, hl=en)
  │                  ▼
  │             extract_specs ─► embed_and_store (MiniLM + FAISS)
  │                                                 │
  ├─ photo ────► vision_identify (Groq vision) ─────┘
  │
  ├─ pdf ──────► parse_pdf (pdfplumber) ─► extract_specs
  │
  ├─ compare ──► retrieve_products (FAISS) ─► compare
  │
  └─ followup ─► load_chat_history (SQLite) ─► rerank (FAISS)
                                                     │
                                                     ▼
                                                   respond (Groq)
                                                     │
                                                     ▼
                                           save_to_sqlite → END
```

## Data boundaries

- Serper receives every shopping search with `gl=in` and `hl=en` so prices/retailers are localized for India.
- FAISS indexes are in process and partitioned by session; SQLite remains the durable source for chat history.
- `scrape_page_details` supports BeautifulSoup extraction of a page description and `og:image` fallback when a deeper product-page enrichment is added.
- Responses are instructed to use only retrieved or uploaded evidence. They disclose absent details and discuss trade-offs, rather than inventing a universal winner.

## HTTP lifecycle

`POST /session` creates the session row. A chat or upload validates that session, invokes the graph asynchronously, persists user and assistant messages, and sends normalized products to the React interface. `GET /history/{session_id}` supports session-resume clients.

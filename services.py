"""External-tool adapters plus local semantic product retrieval."""

import json
import re
from typing import Any

import faiss
import requests
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer

from models import Product
from settings import SERPER_API_KEY


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
        return " ".join([product.name, product.brand, product.price, *[f"{k} {v}" for k, v in product.specs.items()]])

    def add(self, session_id: str, products: list[Product]) -> None:
        """Embed and append products to one session's FAISS inner-product index."""
        if not products:
            return
        embeddings = self._embedder().encode([self._product_text(p) for p in products], normalize_embeddings=True)
        index = self._indexes.setdefault(session_id, faiss.IndexFlatIP(embeddings.shape[1]))
        index.add(embeddings.astype("float32"))
        self._products.setdefault(session_id, []).extend(products)

    def search(self, session_id: str, query: str, limit: int = 6) -> list[Product]:
        """Retrieve the session products semantically closest to a query."""
        index = self._indexes.get(session_id)
        products = self._products.get(session_id, [])
        if index is None or not products:
            return []
        vector = self._embedder().encode([query], normalize_embeddings=True).astype("float32")
        _, ids = index.search(vector, min(limit, len(products)))
        return [products[i] for i in ids[0] if i >= 0]


vector_store = ProductVectorStore()


def search_shopping(query: str) -> list[Product]:
    """Fetch India-localized Serper Shopping listings and normalize them as products."""
    if not SERPER_API_KEY:
        raise RuntimeError("SERPER_API_KEY is not configured.")
    response = requests.post(
        "https://google.serper.dev/shopping",
        headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
        json={"q": query, "gl": "in", "hl": "en"},
        timeout=20,
    )
    response.raise_for_status()
    raw_items = response.json().get("shopping", [])
    products: list[Product] = []
    for item in raw_items[:8]:
        title = item.get("title", "Unnamed product")
        products.append(Product(
            name=title,
            brand=title.split()[0] if title else "Unknown",
            price=item.get("price", "Price unavailable"),
            specs={},
            imageUrl=item.get("imageUrl", item.get("image", "")),
            source=item.get("source", "Search result"),
            link=item.get("link", ""),
        ))
    return products


def scrape_page_details(url: str) -> dict[str, str]:
    """Extract a concise page description and Open Graph image for optional deeper grounding."""
    if not url:
        return {}
    try:
        html = requests.get(url, timeout=10, headers={"User-Agent": "ProductGenie/1.0"}).text
        soup = BeautifulSoup(html, "html.parser")
        description = soup.find("meta", attrs={"name": "description"})
        og_image = soup.find("meta", property="og:image")
        return {
            "description": description.get("content", "") if description else "",
            "imageUrl": og_image.get("content", "") if og_image else "",
        }
    except requests.RequestException:
        return {}


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

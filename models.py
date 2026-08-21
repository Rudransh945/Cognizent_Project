"""Pydantic request and response contracts exposed by the HTTP API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Product(BaseModel):
    """A product normalized from a search result, PDF, or product page."""

    name: str
    brand: str = "Unknown"
    price: str = "Price unavailable"
    specs: dict[str, str] = Field(default_factory=dict)
    imageUrl: str = ""
    source: str = "Unknown"
    link: str = ""
    recommended: bool = False
    description: str = ""
    rating: float | None = None
    rating_count: int | None = None
    delivery: str = ""
    offers: str = ""
    product_id: str = ""
    position: int | None = None


class SessionResponse(BaseModel):
    """Response returned after creating a chat session."""

    session_id: str


class ChatRequest(BaseModel):
    """A user message submitted for a specific session."""

    session_id: str
    message: str = Field(min_length=1, max_length=4000)
    selected_products: list[Product] = Field(default_factory=list, max_length=4)


class ChatResponse(BaseModel):
    """Grounded assistant reply and any products found during the turn."""

    response: str
    products: list[Product] = Field(default_factory=list)
    reasoning_depth: str = ""


class UploadResponse(BaseModel):
    """Result of processing a product image or specification PDF."""

    response: str
    products: list[Product] = Field(default_factory=list)
    reasoning_depth: str = ""


class MessageResponse(BaseModel):
    """A persisted chat message returned by the history endpoint."""

    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime | str

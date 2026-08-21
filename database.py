"""SQLite persistence helpers for ProductGenie chat sessions and product evidence."""

import json
import sqlite3
from contextlib import contextmanager
from typing import Iterator

from settings import DATABASE_PATH


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    """Yield a SQLite connection with rows exposed as dictionary-like objects."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def initialize_database() -> None:
    """Create the durable session, message, and product-evidence tables."""
    with connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                product_name TEXT
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
                content TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            CREATE TABLE IF NOT EXISTS products (
                session_id TEXT NOT NULL,
                product_key TEXT NOT NULL,
                payload TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (session_id, product_key),
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            """
        )
        # Existing local databases predate the category-focus session field.
        columns = {row[1] for row in conn.execute("PRAGMA table_info(sessions)")}
        if "product_name" not in columns:
            conn.execute("ALTER TABLE sessions ADD COLUMN product_name TEXT")


def create_session(session_id: str) -> None:
    """Persist a new session id; repeated calls are harmless."""
    with connection() as conn:
        conn.execute("INSERT OR IGNORE INTO sessions(session_id) VALUES (?)", (session_id,))


def session_exists(session_id: str) -> bool:
    """Return whether a session id has been created previously."""
    with connection() as conn:
        return conn.execute("SELECT 1 FROM sessions WHERE session_id = ?", (session_id,)).fetchone() is not None


def get_session_product_name(session_id: str) -> str:
    """Return the category this chat is dedicated to, if one has been searched."""
    with connection() as conn:
        row = conn.execute("SELECT product_name FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    return str(row["product_name"] or "") if row else ""


def set_session_product_name(session_id: str, product_name: str) -> None:
    """Lock a chat to its first product category without replacing its focus."""
    with connection() as conn:
        conn.execute(
            "UPDATE sessions SET product_name = COALESCE(product_name, ?) WHERE session_id = ?",
            (product_name, session_id),
        )


def save_message(session_id: str, role: str, content: str) -> None:
    """Append one user or assistant message to a session's durable history."""
    with connection() as conn:
        conn.execute(
            "INSERT INTO messages(session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content),
        )


def get_history(session_id: str) -> list[dict[str, str]]:
    """Return all session messages in chronological order for context and API clients."""
    with connection() as conn:
        rows = conn.execute(
            "SELECT role, content, timestamp FROM messages WHERE session_id = ? ORDER BY id", (session_id,)
        ).fetchall()
    return [dict(row) for row in rows]


def save_products(session_id: str, products: list[dict]) -> None:
    """Upsert normalized, source-backed product records for later RAG retrieval."""
    rows = []
    for product in products:
        key = "|".join(str(product.get(field, "")) for field in ("name", "price", "source", "link"))
        rows.append((session_id, key, json.dumps(product, ensure_ascii=False)))
    if not rows:
        return
    with connection() as conn:
        conn.executemany(
            """
            INSERT INTO products(session_id, product_key, payload)
            VALUES (?, ?, ?)
            ON CONFLICT(session_id, product_key) DO UPDATE SET
                payload = excluded.payload,
                updated_at = CURRENT_TIMESTAMP
            """,
            rows,
        )


def get_products(session_id: str) -> list[dict]:
    """Load the complete normalized evidence set for a persisted chat session."""
    with connection() as conn:
        rows = conn.execute(
            "SELECT payload FROM products WHERE session_id = ? ORDER BY updated_at, rowid", (session_id,)
        ).fetchall()
    records: list[dict] = []
    for row in rows:
        try:
            payload = json.loads(row["payload"])
            if isinstance(payload, dict):
                records.append(payload)
        except (TypeError, json.JSONDecodeError):
            continue
    return records

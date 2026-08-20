"""SQLite persistence helpers for ProductGenie chat sessions."""

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
    """Create the sessions and messages tables when the application starts."""
    with connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
                content TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            """
        )


def create_session(session_id: str) -> None:
    """Persist a new session id; repeated calls are harmless."""
    with connection() as conn:
        conn.execute("INSERT OR IGNORE INTO sessions(session_id) VALUES (?)", (session_id,))


def session_exists(session_id: str) -> bool:
    """Return whether a session id has been created previously."""
    with connection() as conn:
        return conn.execute("SELECT 1 FROM sessions WHERE session_id = ?", (session_id,)).fetchone() is not None


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

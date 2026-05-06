"""SQLite connection helper that applies the schema on open."""

import sqlite3
from importlib import resources
from pathlib import Path


def connect(db_path: Path | str) -> sqlite3.Connection:
    path = Path(db_path)
    if path.parent and str(path.parent) not in ('', '.'):
        path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    _apply_schema(conn)
    return conn


def connect_memory() -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    _apply_schema(conn)
    return conn


def _apply_schema(conn: sqlite3.Connection) -> None:
    schema = resources.files('jobtriage.storage').joinpath('schema.sql').read_text()
    conn.executescript(schema)
    conn.commit()

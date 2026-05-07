"""Shared FastAPI dependencies: settings, db connections, embedder."""

import sqlite3
from collections.abc import Iterator
from functools import lru_cache
from typing import cast

from fastapi import Request

from jobtriage.embeddings import (
    DEFAULT_MODEL_NAME,
    Embedder,
    SentenceTransformerEmbedder,
)
from jobtriage.settings import Settings, load_settings
from jobtriage.storage.db import connect


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()


def get_db_connection(request: Request) -> Iterator[sqlite3.Connection]:
    settings = request.app.state.settings
    conn = connect(settings.db_path)
    try:
        yield conn
    finally:
        conn.close()


def get_embedder(request: Request) -> Embedder:
    embedder = getattr(request.app.state, 'embedder', None)
    if embedder is None:
        raise RuntimeError('embedder is not initialized; check app lifespan')
    return cast(Embedder, embedder)


def build_embedder(model_name: str = DEFAULT_MODEL_NAME) -> Embedder:
    return SentenceTransformerEmbedder(model_name=model_name)

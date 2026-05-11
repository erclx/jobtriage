"""Shared FastAPI dependencies: settings, db connections, embedder."""

import sqlite3
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path
from typing import cast

from fastapi import HTTPException, Request

from jobtriage.embeddings import (
    DEFAULT_MODEL_NAME,
    Embedder,
    SentenceTransformerEmbedder,
)
from jobtriage.settings import Settings, load_settings
from jobtriage.storage.db import connect

CORPUS_DISABLED_DETAIL = 'Corpus tools are disabled in deploy mode.'


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()


def get_db_connection(request: Request) -> Iterator[sqlite3.Connection]:
    settings = cast(Settings, request.app.state.settings)
    if settings.deploy_mode == 'slim':
        raise HTTPException(status_code=503, detail=CORPUS_DISABLED_DETAIL)
    conn = connect(settings.db_path)
    try:
        yield conn
    finally:
        conn.close()


def get_embedder(request: Request) -> Embedder:
    embedder = getattr(request.app.state, 'embedder', None)
    if embedder is None:
        raise HTTPException(status_code=503, detail=CORPUS_DISABLED_DETAIL)
    return cast(Embedder, embedder)


def get_engagement_log_path(request: Request) -> Path:
    settings = cast(Settings, request.app.state.settings)
    return settings.engagement_log_path


def build_embedder(model_name: str = DEFAULT_MODEL_NAME) -> Embedder:
    return SentenceTransformerEmbedder(model_name=model_name)

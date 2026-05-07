"""Fixtures wiring the FastAPI app to an in-memory db and a deterministic embedder."""

import sqlite3
from collections.abc import Callable, Iterator
from datetime import datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from jobtriage.api.app import app_factory
from jobtriage.api.dependencies import get_db_connection
from jobtriage.cli.index import embed_pending_chunks
from jobtriage.embeddings import Embedder
from jobtriage.jobtech.models import Ad
from jobtriage.storage.db import connect
from jobtriage.storage.ingest import ingest_ads
from tests.test_retrieval import KeywordEmbedder

AdFactory = Callable[..., Ad]


@pytest.fixture
def seeded_db(tmp_path: Path, make_ad: AdFactory) -> Iterator[Path]:
    db_path = tmp_path / 'jobtriage.db'
    conn = connect(db_path)
    ads = [
        make_ad(
            ad_id='stockholm',
            headline='Senior AI engineer',
            description_text='Build agents in Stockholm with Azure',
            municipality='Stockholm',
            region='reg-stockholm',
            occupation_concept_id='occ-ai',
        ),
        make_ad(
            ad_id='goteborg',
            headline='Backend developer',
            description_text='Backend role in Göteborg',
            municipality='Göteborg',
            region='reg-vastra',
            occupation_concept_id='occ-backend',
        ),
    ]
    ingest_ads(conn, ads, filter_signature='sig', now=datetime(2026, 5, 1))
    embedder = KeywordEmbedder()
    embed_pending_chunks(conn, embedder)
    conn.close()
    yield db_path


@pytest.fixture
def fake_embedder() -> Embedder:
    return KeywordEmbedder()


@pytest.fixture
def app(
    seeded_db: Path, fake_embedder: Embedder, monkeypatch: pytest.MonkeyPatch
) -> FastAPI:
    monkeypatch.setenv('JOBTRIAGE_DB_PATH', str(seeded_db))
    from jobtriage.api import dependencies

    dependencies.get_settings.cache_clear()
    return app_factory(embedder=fake_embedder)


@pytest.fixture
def client(app: FastAPI, seeded_db: Path) -> Iterator[TestClient]:
    def override_db_connection() -> Iterator[sqlite3.Connection]:
        conn = connect(seeded_db)
        try:
            yield conn
        finally:
            conn.close()

    app.dependency_overrides[get_db_connection] = override_db_connection
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

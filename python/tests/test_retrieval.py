"""Tests for retrieval primitives: BM25, dense cosine, and RRF fusion."""

import sqlite3
from collections.abc import Callable
from datetime import datetime

import numpy as np
import pytest

from jobtriage.cli.index import embed_pending_chunks
from jobtriage.embeddings import EmbeddingMatrix
from jobtriage.jobtech.models import Ad
from jobtriage.retrieval import (
    bm25_search,
    dense_search,
    hybrid_search,
    reciprocal_rank_fusion,
)
from jobtriage.storage.ingest import ingest_ads
from tests.test_embeddings import FakeEmbedder

AdFactory = Callable[..., Ad]


class KeywordEmbedder(FakeEmbedder):
    """Encodes presence of fixed keywords as one-hot vectors."""

    KEYWORDS = ('stockholm', 'göteborg', 'azure', 'agent')

    def __init__(self) -> None:
        super().__init__(dimension=len(self.KEYWORDS))

    def _vector(self, text: str) -> EmbeddingMatrix:
        lowered = text.lower()
        components = [1.0 if word in lowered else 0.0 for word in self.KEYWORDS]
        vector = np.array(components, dtype=np.float32)
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
        return vector

    def embed_passages(self, texts: list[str]) -> EmbeddingMatrix:
        return np.stack([self._vector(text) for text in texts])

    def embed_query(self, text: str) -> EmbeddingMatrix:
        return self._vector(text).reshape(1, -1)


def test_rrf_orders_by_combined_reciprocal_ranks() -> None:
    fused = reciprocal_rank_fusion(
        [['a', 'b', 'c'], ['b', 'c', 'a']],
        k=1,
    )
    ad_ids = [ad_id for ad_id, _ in fused]
    assert ad_ids[0] == 'b'
    assert set(ad_ids) == {'a', 'b', 'c'}


def test_rrf_rejects_invalid_k() -> None:
    with pytest.raises(ValueError):
        reciprocal_rank_fusion([['a']], k=0)


def test_bm25_search_finds_matching_chunks(
    memory_db: sqlite3.Connection, make_ad: AdFactory
) -> None:
    ads = [
        make_ad(ad_id='match', description_text='Senior AI engineer in Stockholm'),
        make_ad(ad_id='miss', description_text='Backend developer in Göteborg'),
    ]
    ingest_ads(memory_db, ads, filter_signature='sig')

    results = bm25_search(memory_db, 'Stockholm engineer', top_k=5)
    assert results[0] == 'match'
    assert 'miss' not in results


def test_dense_search_ranks_by_cosine_similarity(
    memory_db: sqlite3.Connection, make_ad: AdFactory
) -> None:
    ads = [
        make_ad(
            ad_id='stockholm',
            description_text='Build agents in Stockholm with Azure',
        ),
        make_ad(
            ad_id='goteborg',
            description_text='Backend role in Göteborg',
        ),
    ]
    ingest_ads(memory_db, ads, filter_signature='sig', now=datetime(2026, 5, 1))
    embedder = KeywordEmbedder()
    embed_pending_chunks(memory_db, embedder)

    query_vector = embedder.embed_query('stockholm')[0]
    results = dense_search(
        memory_db, query_vector, dimension=embedder.dimension, top_k=5
    )
    assert results[0] == 'stockholm'


def test_hybrid_search_returns_hydrated_ad_rows(
    memory_db: sqlite3.Connection, make_ad: AdFactory
) -> None:
    ads = [
        make_ad(
            ad_id='stockholm',
            headline='Senior AI engineer',
            description_text='Build agents in Stockholm with Azure',
        ),
        make_ad(
            ad_id='goteborg',
            headline='Backend developer',
            description_text='Backend role in Göteborg',
        ),
    ]
    ingest_ads(memory_db, ads, filter_signature='sig', now=datetime(2026, 5, 1))
    embedder = KeywordEmbedder()
    embed_pending_chunks(memory_db, embedder)

    results = hybrid_search(memory_db, 'Stockholm agents', embedder, top_k=2)
    assert results[0].ad_id == 'stockholm'
    assert results[0].headline == 'Senior AI engineer'

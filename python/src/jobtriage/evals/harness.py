"""Run the four retrieval configurations against a golden set and emit metrics."""

import sqlite3
import time
from collections.abc import Callable
from dataclasses import dataclass

import numpy as np

from jobtriage.embeddings import Embedder, EmbeddingMatrix
from jobtriage.evals.golden import GoldenQuery, GoldenSet
from jobtriage.retrieval import (
    bm25_search,
    dense_search,
    filter_only_search,
    reciprocal_rank_fusion,
)

EVAL_TOP_K = 10
PRECISION_KS = (1, 5, 10)

ConfigurationRunner = Callable[[GoldenQuery], list[str]]


@dataclass(frozen=True, slots=True)
class ConfigurationMetrics:
    name: str
    precision_at: dict[int, float]
    recall_at_10: float
    p50_ms: float
    p95_ms: float


@dataclass(frozen=True, slots=True)
class EmbeddingAblationRow:
    model_name: str
    dimension: int
    dense_metrics: ConfigurationMetrics
    hybrid_metrics: ConfigurationMetrics


def precision_at_k(retrieved: list[str], expected: set[str], k: int) -> float:
    if k < 1:
        raise ValueError('k must be >= 1')
    head = retrieved[:k]
    if not head:
        return 0.0
    hits = sum(1 for ad_id in head if ad_id in expected)
    return hits / k


def recall_at_k(retrieved: list[str], expected: set[str], k: int) -> float:
    if k < 1:
        raise ValueError('k must be >= 1')
    if not expected:
        return 0.0
    head = retrieved[:k]
    hits = sum(1 for ad_id in head if ad_id in expected)
    return hits / len(expected)


def evaluate_configuration(
    name: str,
    runner: ConfigurationRunner,
    golden: GoldenSet,
) -> ConfigurationMetrics:
    precisions: dict[int, list[float]] = {k: [] for k in PRECISION_KS}
    recalls: list[float] = []
    latencies_ms: list[float] = []

    for query in golden.queries:
        expected = set(query.expected_ad_ids)
        start = time.perf_counter()
        retrieved = runner(query)
        latencies_ms.append((time.perf_counter() - start) * 1000.0)
        for k in PRECISION_KS:
            precisions[k].append(precision_at_k(retrieved, expected, k))
        recalls.append(recall_at_k(retrieved, expected, 10))

    return ConfigurationMetrics(
        name=name,
        precision_at={k: _mean(values) for k, values in precisions.items()},
        recall_at_10=_mean(recalls),
        p50_ms=_percentile(latencies_ms, 50),
        p95_ms=_percentile(latencies_ms, 95),
    )


def build_runners(
    conn: sqlite3.Connection,
    embedder: Embedder,
) -> list[tuple[str, ConfigurationRunner]]:
    def filter_only(query: GoldenQuery) -> list[str]:
        return filter_only_search(conn, top_k=EVAL_TOP_K)

    def bm25_only(query: GoldenQuery) -> list[str]:
        return bm25_search(conn, query.query, top_k=EVAL_TOP_K)

    def dense_only(query: GoldenQuery) -> list[str]:
        vector = embedder.embed_query(query.query)[0]
        return dense_search(
            conn, vector, dimension=embedder.dimension, top_k=EVAL_TOP_K
        )

    def hybrid(query: GoldenQuery) -> list[str]:
        bm25_ranked = bm25_search(conn, query.query, top_k=EVAL_TOP_K)
        vector = embedder.embed_query(query.query)[0]
        dense_ranked = dense_search(
            conn, vector, dimension=embedder.dimension, top_k=EVAL_TOP_K
        )
        fused = reciprocal_rank_fusion([bm25_ranked, dense_ranked])
        return [ad_id for ad_id, _ in fused[:EVAL_TOP_K]]

    return [
        ('filter-only', filter_only),
        ('bm25-only', bm25_only),
        ('dense-only', dense_only),
        ('hybrid', hybrid),
    ]


def render_markdown_table(rows: list[ConfigurationMetrics]) -> str:
    header = (
        '| Configuration | precision@1 | precision@5 | precision@10 | '
        'recall@10 | p50 ms | p95 ms |'
    )
    divider = (
        '| ------------- | ----------- | ----------- | ------------ | '
        '--------- | ------ | ------ |'
    )
    body = [
        f'| {row.name:<13} | {row.precision_at[1]:>11.3f} | '
        f'{row.precision_at[5]:>11.3f} | {row.precision_at[10]:>12.3f} | '
        f'{row.recall_at_10:>9.3f} | {row.p50_ms:>6.1f} | {row.p95_ms:>6.1f} |'
        for row in rows
    ]
    return '\n'.join([header, divider, *body])


def evaluate_embedding_ablation(
    conn: sqlite3.Connection,
    embedder: Embedder,
    model_name: str,
    golden: GoldenSet,
) -> EmbeddingAblationRow:
    chunks = _load_active_chunks(conn)
    if not chunks:
        raise ValueError('no active ad chunks available for ablation')

    chunk_texts = [text for _, text in chunks]
    chunk_ad_ids = [ad_id for ad_id, _ in chunks]
    passage_matrix = embedder.embed_passages(chunk_texts)
    dimension = embedder.dimension

    def dense_runner(query: GoldenQuery) -> list[str]:
        query_vector = embedder.embed_query(query.query)[0]
        return _rank_in_memory(chunk_ad_ids, passage_matrix, query_vector, EVAL_TOP_K)

    def hybrid_runner(query: GoldenQuery) -> list[str]:
        bm25_ranked = bm25_search(conn, query.query, top_k=EVAL_TOP_K)
        query_vector = embedder.embed_query(query.query)[0]
        dense_ranked = _rank_in_memory(
            chunk_ad_ids, passage_matrix, query_vector, EVAL_TOP_K
        )
        fused = reciprocal_rank_fusion([bm25_ranked, dense_ranked])
        return [ad_id for ad_id, _ in fused[:EVAL_TOP_K]]

    return EmbeddingAblationRow(
        model_name=model_name,
        dimension=dimension,
        dense_metrics=evaluate_configuration('dense', dense_runner, golden),
        hybrid_metrics=evaluate_configuration('hybrid', hybrid_runner, golden),
    )


def render_embedding_ablation_table(rows: list[EmbeddingAblationRow]) -> str:
    header = (
        '| Model | Dim | Configuration | precision@1 | precision@5 | '
        'precision@10 | recall@10 | p50 ms | p95 ms |'
    )
    divider = (
        '| ----- | --- | ------------- | ----------- | ----------- | '
        '------------ | --------- | ------ | ------ |'
    )
    body: list[str] = []
    for row in rows:
        for metrics in (row.dense_metrics, row.hybrid_metrics):
            body.append(
                f'| {row.model_name} | {row.dimension} | {metrics.name:<13} | '
                f'{metrics.precision_at[1]:>11.3f} | '
                f'{metrics.precision_at[5]:>11.3f} | '
                f'{metrics.precision_at[10]:>12.3f} | '
                f'{metrics.recall_at_10:>9.3f} | '
                f'{metrics.p50_ms:>6.1f} | {metrics.p95_ms:>6.1f} |'
            )
    return '\n'.join([header, divider, *body])


def _load_active_chunks(conn: sqlite3.Connection) -> list[tuple[str, str]]:
    rows = conn.execute(
        """
        SELECT ad_chunks.ad_id, ad_chunks.chunk_text
        FROM ad_chunks
        JOIN ads ON ads.id = ad_chunks.ad_id
        WHERE ads.is_active = 1
        ORDER BY ad_chunks.ad_id, ad_chunks.chunk_index
        """
    ).fetchall()
    return [(row['ad_id'], row['chunk_text']) for row in rows]


def _rank_in_memory(
    chunk_ad_ids: list[str],
    passage_matrix: EmbeddingMatrix,
    query_vector: EmbeddingMatrix,
    top_k: int,
) -> list[str]:
    if passage_matrix.shape[0] == 0:
        return []
    query = query_vector.reshape(-1).astype(np.float32)
    similarities = passage_matrix @ query

    best_per_ad: dict[str, float] = {}
    for ad_id, similarity in zip(chunk_ad_ids, similarities, strict=True):
        score = float(similarity)
        if ad_id not in best_per_ad or score > best_per_ad[ad_id]:
            best_per_ad[ad_id] = score

    ranked = sorted(best_per_ad.items(), key=lambda pair: pair[1], reverse=True)
    return [ad_id for ad_id, _ in ranked[:top_k]]


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    if not 0 <= percentile <= 100:
        raise ValueError('percentile must be in [0, 100]')
    ordered = sorted(values)
    index = (len(ordered) - 1) * percentile / 100.0
    lower = int(index)
    upper = min(lower + 1, len(ordered) - 1)
    weight = index - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight

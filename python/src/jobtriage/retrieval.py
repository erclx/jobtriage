"""Hybrid retrieval: BM25 over FTS5, dense over chunk embeddings, fused via RRF."""

import re
import sqlite3
from dataclasses import dataclass

import numpy as np

from jobtriage.embeddings import Embedder, EmbeddingMatrix, decode_blob

DEFAULT_RRF_K = 60
DEFAULT_TOP_K = 10


@dataclass(frozen=True, slots=True)
class RankedAd:
    ad_id: str
    score: float
    headline: str
    employer_name: str | None
    municipality: str | None
    application_deadline: str | None
    webpage_url: str | None


def reciprocal_rank_fusion(
    rank_lists: list[list[str]],
    k: int = DEFAULT_RRF_K,
) -> list[tuple[str, float]]:
    if k < 1:
        raise ValueError('k must be >= 1')

    scores: dict[str, float] = {}
    for rank_list in rank_lists:
        for index, ad_id in enumerate(rank_list):
            scores[ad_id] = scores.get(ad_id, 0.0) + 1.0 / (k + index + 1)

    return sorted(scores.items(), key=lambda pair: pair[1], reverse=True)


def bm25_search(
    conn: sqlite3.Connection,
    query: str,
    top_k: int = DEFAULT_TOP_K,
) -> list[str]:
    cleaned = _sanitize_fts_query(query)
    if not cleaned:
        return []

    rows = conn.execute(
        """
        SELECT ad_id, MIN(rank) AS best_rank
        FROM (
            SELECT ad_id, rank
            FROM ad_chunks_fts
            WHERE ad_chunks_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        )
        GROUP BY ad_id
        ORDER BY best_rank
        LIMIT ?
        """,
        (cleaned, top_k * 4, top_k),
    ).fetchall()
    return [row['ad_id'] for row in rows]


def dense_search(
    conn: sqlite3.Connection,
    query_vector: EmbeddingMatrix,
    dimension: int,
    top_k: int = DEFAULT_TOP_K,
) -> list[str]:
    rows = conn.execute(
        'SELECT ad_id, embedding FROM ad_chunks WHERE embedding IS NOT NULL'
    ).fetchall()
    if not rows:
        return []

    query = query_vector.reshape(-1).astype(np.float32)
    if query.size != dimension:
        raise ValueError(
            f'query vector size {query.size} does not match dimension {dimension}'
        )

    matrix = np.stack([decode_blob(row['embedding'], dimension) for row in rows])
    similarities = matrix @ query

    best_per_ad: dict[str, float] = {}
    for row, similarity in zip(rows, similarities, strict=True):
        ad_id = row['ad_id']
        score = float(similarity)
        if ad_id not in best_per_ad or score > best_per_ad[ad_id]:
            best_per_ad[ad_id] = score

    ranked = sorted(best_per_ad.items(), key=lambda pair: pair[1], reverse=True)
    return [ad_id for ad_id, _ in ranked[:top_k]]


def hybrid_search(
    conn: sqlite3.Connection,
    query: str,
    embedder: Embedder,
    top_k: int = DEFAULT_TOP_K,
    rrf_k: int = DEFAULT_RRF_K,
) -> list[RankedAd]:
    bm25_ranked = bm25_search(conn, query, top_k=top_k)
    dense_ranked = dense_search(
        conn,
        embedder.embed_query(query)[0],
        dimension=embedder.dimension,
        top_k=top_k,
    )
    fused = reciprocal_rank_fusion([bm25_ranked, dense_ranked], k=rrf_k)
    return _hydrate(conn, fused[:top_k])


def filter_only_search(
    conn: sqlite3.Connection,
    occupation_concept_id: str | None = None,
    region: str | None = None,
    top_k: int = DEFAULT_TOP_K,
) -> list[str]:
    clauses = ['is_active = 1']
    params: list[object] = []
    if occupation_concept_id:
        clauses.append('occupation_concept_id = ?')
        params.append(occupation_concept_id)
    if region:
        clauses.append('region = ?')
        params.append(region)
    params.append(top_k)
    rows = conn.execute(
        f'SELECT id FROM ads WHERE {" AND ".join(clauses)} '
        'ORDER BY last_seen DESC LIMIT ?',
        params,
    ).fetchall()
    return [row['id'] for row in rows]


def _hydrate(
    conn: sqlite3.Connection,
    scored: list[tuple[str, float]],
) -> list[RankedAd]:
    if not scored:
        return []
    placeholders = ','.join('?' * len(scored))
    rows = conn.execute(
        f"""
        SELECT id, headline, employer_name, municipality,
               application_deadline, webpage_url
        FROM ads
        WHERE id IN ({placeholders})
        """,
        [ad_id for ad_id, _ in scored],
    ).fetchall()
    by_id = {row['id']: row for row in rows}

    results: list[RankedAd] = []
    for ad_id, score in scored:
        row = by_id.get(ad_id)
        if row is None:
            continue
        results.append(
            RankedAd(
                ad_id=ad_id,
                score=score,
                headline=row['headline'],
                employer_name=row['employer_name'],
                municipality=row['municipality'],
                application_deadline=row['application_deadline'],
                webpage_url=row['webpage_url'],
            )
        )
    return results


_FTS_TOKEN = re.compile(r'\w+', re.UNICODE)


def _sanitize_fts_query(query: str) -> str:
    tokens = _FTS_TOKEN.findall(query)
    if not tokens:
        return ''
    return ' OR '.join(f'"{token}"' for token in tokens)

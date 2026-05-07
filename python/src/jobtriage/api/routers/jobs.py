"""Job search endpoints wrapping the v0/v1 retrieval primitives."""

import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

from jobtriage.api.dependencies import get_db_connection, get_embedder
from jobtriage.api.schemas import (
    AdSummary,
    JobSearchRequest,
    JobSearchResponse,
    RankedAd,
    SemanticSearchRequest,
    SemanticSearchResponse,
)
from jobtriage.embeddings import Embedder
from jobtriage.retrieval import filter_only_search, hybrid_search

router = APIRouter(prefix='/v1/jobs', tags=['jobs'])


@router.post('/search', response_model=JobSearchResponse)
async def search_jobs(
    payload: JobSearchRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db_connection)],
) -> JobSearchResponse:
    ad_ids = await run_in_threadpool(
        filter_only_search,
        conn,
        payload.occupation_concept_id,
        payload.region,
        payload.top_k,
    )
    if not ad_ids:
        return JobSearchResponse(results=[])

    rows = await run_in_threadpool(_hydrate_summaries, conn, ad_ids)
    return JobSearchResponse(results=rows)


@router.post('/semantic', response_model=SemanticSearchResponse)
async def semantic_search(
    payload: SemanticSearchRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db_connection)],
    embedder: Annotated[Embedder, Depends(get_embedder)],
) -> SemanticSearchResponse:
    ranked = await run_in_threadpool(
        hybrid_search,
        conn,
        payload.query,
        embedder,
        payload.top_k,
    )
    return SemanticSearchResponse(
        results=[
            RankedAd(
                ad_id=ad.ad_id,
                score=ad.score,
                headline=ad.headline,
                employer_name=ad.employer_name,
                municipality=ad.municipality,
                application_deadline=ad.application_deadline,
                webpage_url=ad.webpage_url,
            )
            for ad in ranked
        ]
    )


def _hydrate_summaries(conn: sqlite3.Connection, ad_ids: list[str]) -> list[AdSummary]:
    placeholders = ','.join('?' * len(ad_ids))
    rows = conn.execute(
        f"""
        SELECT id, headline, employer_name, municipality,
               application_deadline, webpage_url
        FROM ads
        WHERE id IN ({placeholders})
        """,
        ad_ids,
    ).fetchall()
    by_id = {row['id']: row for row in rows}
    summaries: list[AdSummary] = []
    for ad_id in ad_ids:
        row = by_id.get(ad_id)
        if row is None:
            continue
        summaries.append(
            AdSummary(
                ad_id=ad_id,
                headline=row['headline'],
                employer_name=row['employer_name'],
                municipality=row['municipality'],
                application_deadline=row['application_deadline'],
                webpage_url=row['webpage_url'],
            )
        )
    return summaries

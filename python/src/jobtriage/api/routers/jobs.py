"""Job search endpoints wrapping the v0/v1 retrieval primitives."""

import sqlite3
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from jobtriage.api.dependencies import get_db_connection, get_embedder
from jobtriage.api.schemas import (
    AdDetail,
    AdSummary,
    DeadlineAd,
    DeadlineRequest,
    DeadlineResponse,
    JobDetailsRequest,
    JobDetailsResponse,
    JobSearchRequest,
    JobSearchResponse,
    RankedAd,
    SemanticSearchRequest,
    SemanticSearchResponse,
    TriagedAd,
    TriageRequest,
    TriageResponse,
)
from jobtriage.embeddings import Embedder
from jobtriage.retrieval import filter_only_search, hybrid_search

router = APIRouter(prefix='/v1/jobs', tags=['jobs'])

EXCERPT_MAX_CHARS = 480


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


@router.post('/details', response_model=JobDetailsResponse)
async def fetch_job_details(
    payload: JobDetailsRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db_connection)],
) -> JobDetailsResponse:
    rows = await run_in_threadpool(_hydrate_details, conn, payload.ad_ids)
    return JobDetailsResponse(results=rows)


@router.post('/triage', response_model=TriageResponse)
async def triage(
    payload: TriageRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db_connection)],
    embedder: Annotated[Embedder, Depends(get_embedder)],
) -> TriageResponse:
    ranked = await run_in_threadpool(
        hybrid_search,
        conn,
        payload.query,
        embedder,
        payload.top_k,
    )
    if not ranked:
        return TriageResponse(results=[])

    ad_ids = [ad.ad_id for ad in ranked]
    excerpts = await run_in_threadpool(_first_chunks, conn, ad_ids)
    return TriageResponse(
        results=[
            TriagedAd(
                ad_id=ad.ad_id,
                score=ad.score,
                headline=ad.headline,
                employer_name=ad.employer_name,
                municipality=ad.municipality,
                application_deadline=ad.application_deadline,
                webpage_url=ad.webpage_url,
                description_excerpt=excerpts.get(ad.ad_id, ''),
            )
            for ad in ranked
        ]
    )


@router.post('/deadline', response_model=DeadlineResponse)
async def deadline_watch(
    payload: DeadlineRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db_connection)],
) -> DeadlineResponse:
    today = date.today()
    until = today + timedelta(days=payload.window_days)
    rows = await run_in_threadpool(
        _deadline_rows,
        conn,
        today.isoformat(),
        until.isoformat(),
        payload.region,
        payload.top_k,
    )
    return DeadlineResponse(
        results=[_to_deadline_ad(row) for row in rows if row['days'] >= 0]
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


def _hydrate_details(conn: sqlite3.Connection, ad_ids: list[str]) -> list[AdDetail]:
    placeholders = ','.join('?' * len(ad_ids))
    rows = conn.execute(
        f"""
        SELECT id, headline, employer_name, municipality, occupation_label,
               application_deadline, webpage_url, description_text
        FROM ads
        WHERE id IN ({placeholders})
        """,
        ad_ids,
    ).fetchall()
    by_id = {row['id']: row for row in rows}
    missing = [ad_id for ad_id in ad_ids if ad_id not in by_id]
    if missing:
        raise HTTPException(status_code=404, detail=f'Unknown ad ids: {missing}')

    details: list[AdDetail] = []
    for ad_id in ad_ids:
        row = by_id[ad_id]
        details.append(
            AdDetail(
                ad_id=ad_id,
                headline=row['headline'],
                employer_name=row['employer_name'],
                municipality=row['municipality'],
                occupation_label=row['occupation_label'],
                application_deadline=row['application_deadline'],
                webpage_url=row['webpage_url'],
                description_excerpt=_clip_excerpt(row['description_text']),
            )
        )
    return details


def _first_chunks(conn: sqlite3.Connection, ad_ids: list[str]) -> dict[str, str]:
    placeholders = ','.join('?' * len(ad_ids))
    rows = conn.execute(
        f"""
        SELECT ad_id, chunk_text
        FROM ad_chunks
        WHERE ad_id IN ({placeholders}) AND chunk_index = 0
        """,
        ad_ids,
    ).fetchall()
    return {row['ad_id']: _clip_excerpt(row['chunk_text']) for row in rows}


def _deadline_rows(
    conn: sqlite3.Connection,
    today_iso: str,
    until_iso: str,
    region: str | None,
    top_k: int,
) -> list[sqlite3.Row]:
    clauses = [
        'is_active = 1',
        'application_deadline IS NOT NULL',
        "application_deadline != ''",
        'application_deadline >= ?',
        'application_deadline <= ?',
    ]
    params: list[object] = [today_iso, until_iso]
    if region:
        clauses.append('region = ?')
        params.append(region)
    params.append(top_k)
    rows = conn.execute(
        f"""
        SELECT id, headline, employer_name, municipality,
               application_deadline, webpage_url,
               (julianday(substr(application_deadline, 1, 10)) - julianday(?))
                   AS days
        FROM ads
        WHERE {' AND '.join(clauses)}
        ORDER BY application_deadline ASC
        LIMIT ?
        """,
        [today_iso, *params],
    ).fetchall()
    return rows


def _to_deadline_ad(row: sqlite3.Row) -> DeadlineAd:
    days = int(row['days']) if row['days'] is not None else 0
    return DeadlineAd(
        ad_id=row['id'],
        headline=row['headline'],
        employer_name=row['employer_name'],
        municipality=row['municipality'],
        application_deadline=row['application_deadline'],
        webpage_url=row['webpage_url'],
        days_until_deadline=max(days, 0),
    )


def _clip_excerpt(text: str | None) -> str:
    if not text:
        return ''
    cleaned = ' '.join(text.split())
    if len(cleaned) <= EXCERPT_MAX_CHARS:
        return cleaned
    return cleaned[:EXCERPT_MAX_CHARS].rstrip() + '…'

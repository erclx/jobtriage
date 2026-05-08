"""Read-only engagement-status endpoint backed by the markdown log."""

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from jobtriage.api.dependencies import get_engagement_log_path
from jobtriage.api.schemas import EngagementEntry, EngagementStatusResponse
from jobtriage.engagement import read_status

router = APIRouter(prefix='/v1/engagements', tags=['engagements'])


@router.get('/status', response_model=EngagementStatusResponse)
async def engagement_status(
    log_path: Annotated[Path, Depends(get_engagement_log_path)],
    ad_id: Annotated[str, Query(min_length=1, max_length=128)],
) -> EngagementStatusResponse:
    cleaned = ad_id.strip()
    if not cleaned:
        raise HTTPException(status_code=422, detail='ad_id must not be blank')

    entries = await run_in_threadpool(read_status, log_path, cleaned)
    return EngagementStatusResponse(
        ad_id=cleaned,
        entries=[
            EngagementEntry(
                recorded_on=entry.recorded_on,
                status=entry.status,
                note=entry.note,
            )
            for entry in entries
        ],
    )

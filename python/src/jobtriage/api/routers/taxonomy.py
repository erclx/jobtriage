"""JobTech taxonomy lookup endpoint for the deploy posture."""

from typing import Annotated

from fastapi import APIRouter, Depends

from jobtriage.api.dependencies import get_settings
from jobtriage.api.schemas import (
    Concept,
    LookupConceptRequest,
    LookupConceptResponse,
)
from jobtriage.jobtech.client import JobTechClient
from jobtriage.settings import Settings

router = APIRouter(prefix='/v1/taxonomy', tags=['taxonomy'])


@router.post('/lookup', response_model=LookupConceptResponse)
async def lookup_concept(
    payload: LookupConceptRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> LookupConceptResponse:
    async with JobTechClient(
        base_url=settings.jobtech_base_url,
        timeout_seconds=settings.jobtech_timeout_seconds,
    ) as client:
        concepts = await client.search_concepts(payload.query, limit=payload.top_k)

    return LookupConceptResponse(
        results=[
            Concept(
                concept_id=concept.concept_id,
                preferred_label=concept.preferred_label,
                type=concept.type,
            )
            for concept in concepts
        ]
    )

"""Health endpoint exposing the runtime configuration."""

from typing import Annotated

from fastapi import APIRouter, Depends

from jobtriage.api.dependencies import get_settings
from jobtriage.api.schemas import HealthResponse
from jobtriage.embeddings import DEFAULT_MODEL_NAME
from jobtriage.settings import Settings

router = APIRouter(tags=['health'])


@router.get('/healthz', response_model=HealthResponse)
async def healthz(
    settings: Annotated[Settings, Depends(get_settings)],
) -> HealthResponse:
    return HealthResponse(
        status='ok',
        db_path=str(settings.db_path),
        model_name=DEFAULT_MODEL_NAME,
    )

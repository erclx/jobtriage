"""FastAPI app factory for the jobtriage HTTP layer."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from jobtriage.api.dependencies import build_embedder, get_settings
from jobtriage.api.routers import engagements, health, jobs, taxonomy
from jobtriage.embeddings import DEFAULT_MODEL_NAME, Embedder
from jobtriage.errors import JobTechAPIError

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    app.state.settings = settings

    if settings.deploy_mode == 'slim':
        app.state.embedder = None
        logger.info(
            'api_startup_complete deploy_mode=slim corpus_tools=disabled',
        )
    else:
        embedder = build_embedder(model_name=DEFAULT_MODEL_NAME)
        embedder.embed_query('warm-up')
        app.state.embedder = embedder
        logger.info(
            'api_startup_complete db_path=%s model=%s',
            settings.db_path,
            DEFAULT_MODEL_NAME,
        )
    try:
        yield
    finally:
        logger.info('api_shutdown')


def app_factory(*, embedder: Embedder | None = None) -> FastAPI:
    app = FastAPI(
        title='jobtriage',
        version='0.1.0',
        summary='HTTP layer over the jobtriage Python tools.',
        lifespan=None if embedder is not None else lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=['http://localhost:3000', 'http://127.0.0.1:3000'],
        allow_methods=['GET', 'POST'],
        allow_headers=['*'],
    )

    if embedder is not None:
        app.state.settings = get_settings()
        app.state.embedder = embedder

    app.include_router(health.router)
    app.include_router(jobs.router)
    app.include_router(engagements.router)
    app.include_router(taxonomy.router)

    @app.exception_handler(JobTechAPIError)
    async def _jobtech_error_handler(_: Request, exc: JobTechAPIError) -> JSONResponse:
        logger.error('jobtech_api_error status=%s', exc.status_code)
        return JSONResponse(
            status_code=502,
            content={'detail': 'Upstream JobTech API error.'},
        )

    @app.exception_handler(ValueError)
    async def _value_error_handler(_: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(status_code=400, content={'detail': str(exc)})

    return app

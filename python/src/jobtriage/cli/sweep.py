import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Annotated

import typer

from jobtriage.errors import JobTechAPIError
from jobtriage.jobtech.client import JobTechClient, SearchFilter, collect_ads
from jobtriage.settings import load_settings
from jobtriage.storage.db import connect
from jobtriage.storage.ingest import IngestResult, ingest_ads

logger = logging.getLogger(__name__)


def sweep_command(
    occupation_code: Annotated[
        str | None,
        typer.Option('--occupation-code', help='JobTech occupation concept id.'),
    ] = None,
    region: Annotated[
        str | None, typer.Option('--region', help='JobTech region concept id.')
    ] = None,
    deadline_before: Annotated[
        datetime | None,
        typer.Option(
            '--deadline-before',
            formats=['%Y-%m-%d'],
            help='Drop ads whose deadline is on or after this date (YYYY-MM-DD).',
        ),
    ] = None,
    employer: Annotated[
        str | None, typer.Option('--employer', help='Employer name filter.')
    ] = None,
    db: Annotated[
        Path | None, typer.Option('--db', help='Override SQLite database path.')
    ] = None,
    page_size: Annotated[
        int, typer.Option('--page-size', help='Page size when walking the JobTech API.')
    ] = 100,
) -> None:
    if not any([occupation_code, region, employer]):
        raise typer.BadParameter(
            'At least one of --occupation-code, --region, --employer is required.'
        )

    settings = load_settings()
    db_path = db or settings.db_path

    filter_ = SearchFilter(
        occupation_code=occupation_code,
        region=region,
        deadline_before=deadline_before.date() if deadline_before else None,
        employer=employer,
    )

    result = asyncio.run(
        _run_sweep(
            base_url=settings.jobtech_base_url,
            timeout_seconds=settings.jobtech_timeout_seconds,
            db_path=db_path,
            filter_=filter_,
            page_size=page_size,
        )
    )

    typer.echo(
        f'sweep complete: inserted={result.inserted} updated={result.updated} '
        f'deactivated={result.deactivated} db={db_path}'
    )


async def _run_sweep(
    base_url: str,
    timeout_seconds: float,
    db_path: Path,
    filter_: SearchFilter,
    page_size: int,
) -> IngestResult:
    async with JobTechClient(
        base_url=base_url, timeout_seconds=timeout_seconds
    ) as client:
        try:
            ads = await collect_ads(client, filter_, page_size=page_size)
        except JobTechAPIError as err:
            logger.error('jobtech_api_error status=%s', err.status_code)
            raise typer.Exit(code=2) from err

    conn = connect(db_path)
    try:
        return ingest_ads(conn, ads, filter_signature=filter_.signature())
    finally:
        conn.close()

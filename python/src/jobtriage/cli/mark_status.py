from pathlib import Path
from typing import Annotated

import typer

from jobtriage.engagement import Status, record_status
from jobtriage.settings import load_settings


def mark_status_command(
    ad_id: Annotated[str, typer.Argument(help='JobTech ad id.')],
    status: Annotated[Status, typer.Argument(help='Engagement status.')],
    note: Annotated[
        str | None, typer.Option('--note', help='Optional free-form note for the row.')
    ] = None,
    log: Annotated[
        Path | None, typer.Option('--log', help='Override engagement log path.')
    ] = None,
) -> None:
    settings = load_settings()
    log_path = log or settings.engagement_log_path
    record_status(log_path=log_path, ad_id=ad_id, status=status, note=note)
    typer.echo(f'recorded {status.value} for {ad_id} -> {log_path}')

"""Append engagement status rows to a markdown log file."""

from datetime import date, datetime
from enum import StrEnum
from pathlib import Path

_HEADER = '# Engagement log\n\n'


class Status(StrEnum):
    SHORTLISTED = 'shortlisted'
    INTERESTED = 'interested'
    APPLIED = 'applied'
    DECLINED = 'declined'


def record_status(
    log_path: Path,
    ad_id: str,
    status: Status,
    note: str | None = None,
    today: date | None = None,
) -> None:
    if not ad_id.strip():
        raise ValueError('ad_id must not be empty')

    log_path.parent.mkdir(parents=True, exist_ok=True)
    if not log_path.exists():
        log_path.write_text(_HEADER, encoding='utf-8')

    stamp = (today or datetime.now().date()).isoformat()
    note_part = note.strip() if note and note.strip() else ''
    row = f'- {stamp} | {ad_id} | {status.value} | {note_part}\n'

    with log_path.open('a', encoding='utf-8') as handle:
        handle.write(row)

"""Append engagement status rows to a markdown log file."""

from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum
from pathlib import Path

_HEADER = '# Engagement log\n\n'
_ROW_PREFIX = '- '
_FIELD_COUNT = 4


class Status(StrEnum):
    SHORTLISTED = 'shortlisted'
    INTERESTED = 'interested'
    APPLIED = 'applied'
    DECLINED = 'declined'


@dataclass(frozen=True, slots=True)
class StatusEntry:
    recorded_on: str
    ad_id: str
    status: str
    note: str


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


def read_status(log_path: Path, ad_id: str) -> list[StatusEntry]:
    if not ad_id.strip():
        raise ValueError('ad_id must not be empty')

    if not log_path.exists():
        return []

    entries: list[StatusEntry] = []
    for line in log_path.read_text(encoding='utf-8').splitlines():
        if not line.startswith(_ROW_PREFIX):
            continue
        fields = [part.strip() for part in line[len(_ROW_PREFIX) :].split('|')]
        if len(fields) < _FIELD_COUNT:
            continue
        recorded_on, row_ad_id, status, note = fields[:_FIELD_COUNT]
        if row_ad_id != ad_id:
            continue
        entries.append(
            StatusEntry(
                recorded_on=recorded_on,
                ad_id=row_ad_id,
                status=status,
                note=note,
            )
        )
    return entries

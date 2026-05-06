from datetime import date
from pathlib import Path

import pytest

from jobtriage.engagement import Status, record_status


def test_record_status_creates_file_with_header(tmp_path: Path) -> None:
    log = tmp_path / 'log.md'
    record_status(log, ad_id='ad-1', status=Status.SHORTLISTED, today=date(2026, 5, 7))

    text = log.read_text(encoding='utf-8')
    assert text.startswith('# Engagement log\n\n')
    assert text.endswith('- 2026-05-07 | ad-1 | shortlisted | \n')


def test_record_status_appends_to_existing_log(tmp_path: Path) -> None:
    log = tmp_path / 'log.md'
    record_status(log, ad_id='ad-1', status=Status.APPLIED, today=date(2026, 5, 1))
    record_status(
        log,
        ad_id='ad-2',
        status=Status.DECLINED,
        note='wrong stack',
        today=date(2026, 5, 2),
    )

    rows = [
        line
        for line in log.read_text(encoding='utf-8').splitlines()
        if line.startswith('- ')
    ]
    assert rows == [
        '- 2026-05-01 | ad-1 | applied | ',
        '- 2026-05-02 | ad-2 | declined | wrong stack',
    ]


def test_record_status_creates_parent_directory(tmp_path: Path) -> None:
    log = tmp_path / 'engagements' / 'log.md'
    record_status(log, ad_id='ad-1', status=Status.INTERESTED, today=date(2026, 5, 7))

    assert log.exists()


def test_record_status_rejects_blank_ad_id(tmp_path: Path) -> None:
    log = tmp_path / 'log.md'
    with pytest.raises(ValueError):
        record_status(log, ad_id='   ', status=Status.APPLIED)

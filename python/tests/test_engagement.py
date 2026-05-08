"""Tests for the engagement log writer."""

from datetime import date
from pathlib import Path

import pytest

from jobtriage.engagement import Status, read_status, record_status


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


def test_read_status_returns_matching_entries_in_log_order(tmp_path: Path) -> None:
    log = tmp_path / 'log.md'
    record_status(log, ad_id='ad-1', status=Status.APPLIED, today=date(2026, 5, 1))
    record_status(
        log,
        ad_id='ad-2',
        status=Status.DECLINED,
        note='wrong stack',
        today=date(2026, 5, 2),
    )
    record_status(
        log,
        ad_id='ad-1',
        status=Status.INTERESTED,
        today=date(2026, 5, 3),
    )

    entries = read_status(log, ad_id='ad-1')

    assert len(entries) == 2
    assert entries[0].recorded_on == '2026-05-01'
    assert entries[0].status == 'applied'
    assert entries[1].recorded_on == '2026-05-03'
    assert entries[1].status == 'interested'


def test_read_status_returns_empty_when_log_missing(tmp_path: Path) -> None:
    log = tmp_path / 'never.md'

    assert read_status(log, ad_id='ad-1') == []


def test_read_status_returns_empty_when_ad_id_absent(tmp_path: Path) -> None:
    log = tmp_path / 'log.md'
    record_status(log, ad_id='ad-2', status=Status.APPLIED, today=date(2026, 5, 1))

    assert read_status(log, ad_id='ad-1') == []


def test_read_status_rejects_blank_ad_id(tmp_path: Path) -> None:
    log = tmp_path / 'log.md'
    with pytest.raises(ValueError):
        read_status(log, ad_id='   ')

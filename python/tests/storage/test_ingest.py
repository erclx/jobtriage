"""Tests for append-mostly ad ingestion."""

import sqlite3
from collections.abc import Callable
from datetime import datetime

from jobtriage.jobtech.models import Ad
from jobtriage.storage.ingest import ingest_ads

AdFactory = Callable[..., Ad]

SIGNATURE = 'occ=occ-1|region=|deadline=|employer='


def _count_rows(conn: sqlite3.Connection, table: str) -> int:
    row = conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()
    return int(row[0])


def test_first_ingest_inserts_rows_and_chunks(
    memory_db: sqlite3.Connection, make_ad: AdFactory
) -> None:
    ads = [make_ad(ad_id='a'), make_ad(ad_id='b', description_text='Different body.')]

    result = ingest_ads(memory_db, ads, filter_signature=SIGNATURE)

    assert result.inserted == 2
    assert result.updated == 0
    assert result.deactivated == 0
    assert _count_rows(memory_db, 'ads') == 2
    assert _count_rows(memory_db, 'ad_chunks') == 2


def test_re_ingest_updates_existing_without_duplicating(
    memory_db: sqlite3.Connection, make_ad: AdFactory
) -> None:
    ads = [make_ad(ad_id='a')]
    ingest_ads(memory_db, ads, filter_signature=SIGNATURE, now=datetime(2026, 5, 1))

    again = ingest_ads(
        memory_db,
        [make_ad(ad_id='a', headline='Updated headline')],
        filter_signature=SIGNATURE,
        now=datetime(2026, 5, 7),
    )

    assert again.inserted == 0
    assert again.updated == 1
    row = memory_db.execute(
        'SELECT headline, last_seen FROM ads WHERE id = ?', ('a',)
    ).fetchone()
    assert row['headline'] == 'Updated headline'
    assert row['last_seen'] == '2026-05-07T00:00:00'


def test_chunks_rewrite_only_when_description_changes(
    memory_db: sqlite3.Connection, make_ad: AdFactory
) -> None:
    ingest_ads(
        memory_db,
        [make_ad(ad_id='a', description_text='one')],
        filter_signature=SIGNATURE,
    )
    ingest_ads(
        memory_db,
        [make_ad(ad_id='a', description_text='one')],
        filter_signature=SIGNATURE,
    )

    chunks_after_idempotent = _count_rows(memory_db, 'ad_chunks')
    assert chunks_after_idempotent == 1

    ingest_ads(
        memory_db,
        [make_ad(ad_id='a', description_text='two')],
        filter_signature=SIGNATURE,
    )
    chunks_after_change = memory_db.execute(
        'SELECT chunk_text FROM ad_chunks WHERE ad_id = ?', ('a',)
    ).fetchall()
    assert [row['chunk_text'] for row in chunks_after_change] == ['two']


def test_missing_ads_are_deactivated_within_same_filter(
    memory_db: sqlite3.Connection, make_ad: AdFactory
) -> None:
    ingest_ads(
        memory_db,
        [make_ad(ad_id='a'), make_ad(ad_id='b')],
        filter_signature=SIGNATURE,
    )

    result = ingest_ads(memory_db, [make_ad(ad_id='a')], filter_signature=SIGNATURE)

    assert result.deactivated == 1
    active = memory_db.execute('SELECT id FROM ads WHERE is_active = 1').fetchall()
    inactive = memory_db.execute('SELECT id FROM ads WHERE is_active = 0').fetchall()
    assert {row['id'] for row in active} == {'a'}
    assert {row['id'] for row in inactive} == {'b'}


def test_deactivation_is_scoped_to_filter_signature(
    memory_db: sqlite3.Connection, make_ad: AdFactory
) -> None:
    other = 'occ=occ-2|region=|deadline=|employer='
    ingest_ads(memory_db, [make_ad(ad_id='other')], filter_signature=other)
    ingest_ads(memory_db, [make_ad(ad_id='a')], filter_signature=SIGNATURE)

    result = ingest_ads(memory_db, [], filter_signature=SIGNATURE)

    assert result.deactivated == 1
    other_row = memory_db.execute(
        'SELECT is_active FROM ads WHERE id = ?', ('other',)
    ).fetchone()
    assert other_row['is_active'] == 1

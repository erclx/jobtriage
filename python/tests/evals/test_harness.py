"""Tests for the eval harness math and configuration runners."""

import sqlite3
from collections.abc import Callable
from datetime import datetime

import pytest

from jobtriage.cli.index import embed_pending_chunks
from jobtriage.evals.golden import GoldenQuery, GoldenSet
from jobtriage.evals.harness import (
    build_runners,
    evaluate_configuration,
    precision_at_k,
    recall_at_k,
    render_markdown_table,
)
from jobtriage.jobtech.models import Ad
from jobtriage.storage.ingest import ingest_ads
from tests.test_retrieval import KeywordEmbedder

AdFactory = Callable[..., Ad]


def test_precision_at_k_counts_hits_in_head() -> None:
    assert precision_at_k(['a', 'b', 'c'], {'a', 'c'}, 3) == pytest.approx(2 / 3)
    assert precision_at_k(['a', 'b'], {'z'}, 2) == 0.0
    assert precision_at_k([], {'a'}, 3) == 0.0


def test_recall_at_k_divides_hits_by_expected() -> None:
    assert recall_at_k(['a', 'b'], {'a', 'b', 'c'}, 2) == pytest.approx(2 / 3)
    assert recall_at_k(['a'], set(), 1) == 0.0


def test_evaluate_configuration_reports_metrics(
    memory_db: sqlite3.Connection, make_ad: AdFactory
) -> None:
    ads = [
        make_ad(
            ad_id='stockholm',
            description_text='Senior AI engineer in Stockholm',
        ),
        make_ad(
            ad_id='goteborg',
            description_text='Backend developer in Göteborg',
        ),
    ]
    ingest_ads(memory_db, ads, filter_signature='sig', now=datetime(2026, 5, 1))
    embedder = KeywordEmbedder()
    embed_pending_chunks(memory_db, embedder)

    golden = GoldenSet(
        queries=[
            GoldenQuery(query='stockholm', expected_ad_ids=['stockholm']),
            GoldenQuery(query='göteborg', expected_ad_ids=['goteborg']),
        ]
    )
    runners = build_runners(memory_db, embedder)
    metrics_by_name = {
        name: evaluate_configuration(name, runner, golden) for name, runner in runners
    }

    assert metrics_by_name['hybrid'].precision_at[1] == pytest.approx(1.0)
    assert metrics_by_name['hybrid'].recall_at_10 == pytest.approx(1.0)


def test_render_markdown_table_emits_one_row_per_metric(
    memory_db: sqlite3.Connection, make_ad: AdFactory
) -> None:
    ingest_ads(
        memory_db,
        [make_ad(ad_id='only', description_text='Stockholm role')],
        filter_signature='sig',
    )
    embedder = KeywordEmbedder()
    embed_pending_chunks(memory_db, embedder)

    golden = GoldenSet(
        queries=[GoldenQuery(query='stockholm', expected_ad_ids=['only'])]
    )
    runners = build_runners(memory_db, embedder)
    rows = [evaluate_configuration(name, runner, golden) for name, runner in runners]

    rendered = render_markdown_table(rows)
    assert rendered.count('\n') >= len(rows) + 1
    for name, _ in runners:
        assert name in rendered

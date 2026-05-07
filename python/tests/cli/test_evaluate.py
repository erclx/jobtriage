"""CLI smoke test for the evaluate command."""

from collections.abc import Callable
from datetime import datetime
from pathlib import Path

import pytest
from typer.testing import CliRunner

from jobtriage.cli import app
from jobtriage.cli.index import embed_pending_chunks
from jobtriage.jobtech.models import Ad
from jobtriage.storage.db import connect
from jobtriage.storage.ingest import ingest_ads
from tests.test_retrieval import KeywordEmbedder

AdFactory = Callable[..., Ad]


@pytest.fixture
def populated_db(tmp_path: Path, make_ad: AdFactory) -> Path:
    db_path = tmp_path / 'corpus.db'
    conn = connect(db_path)
    try:
        ingest_ads(
            conn,
            [
                make_ad(
                    ad_id='stockholm',
                    description_text='Senior AI engineer in Stockholm',
                ),
                make_ad(
                    ad_id='goteborg',
                    description_text='Backend developer in Göteborg',
                ),
            ],
            filter_signature='sig',
            now=datetime(2026, 5, 1),
        )
        embed_pending_chunks(conn, KeywordEmbedder())
    finally:
        conn.close()
    return db_path


@pytest.fixture
def golden_path(tmp_path: Path) -> Path:
    path = tmp_path / 'golden.yaml'
    path.write_text(
        """
queries:
  - query: stockholm
    expected_ad_ids: [stockholm]
  - query: göteborg
    expected_ad_ids: [goteborg]
""",
        encoding='utf-8',
    )
    return path


def test_evaluate_command_emits_markdown_table(
    populated_db: Path,
    golden_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from jobtriage.cli import evaluate as evaluate_module

    monkeypatch.setattr(
        evaluate_module,
        'SentenceTransformerEmbedder',
        lambda model_name: KeywordEmbedder(),
    )

    runner = CliRunner()
    result = runner.invoke(
        app,
        [
            'evaluate',
            '--db',
            str(populated_db),
            '--golden',
            str(golden_path),
        ],
    )

    assert result.exit_code == 0, result.output
    assert 'precision@1' in result.output
    assert 'hybrid' in result.output

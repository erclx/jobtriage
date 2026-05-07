"""CLI smoke test for the search command using a fake embedder."""

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
                    headline='Senior AI engineer',
                    description_text='Build agents in Stockholm with Azure',
                ),
                make_ad(
                    ad_id='goteborg',
                    headline='Backend developer',
                    description_text='Backend role in Göteborg',
                ),
            ],
            filter_signature='sig',
            now=datetime(2026, 5, 1),
        )
        embed_pending_chunks(conn, KeywordEmbedder())
    finally:
        conn.close()
    return db_path


def test_search_command_prints_top_results(
    populated_db: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from jobtriage.cli import search as search_module

    monkeypatch.setattr(
        search_module,
        'SentenceTransformerEmbedder',
        lambda model_name: KeywordEmbedder(),
    )

    runner = CliRunner()
    result = runner.invoke(
        app, ['search', 'Stockholm agents', '--db', str(populated_db), '--top-k', '2']
    )

    assert result.exit_code == 0, result.output
    assert 'Senior AI engineer' in result.output
    assert 'stockholm' in result.output

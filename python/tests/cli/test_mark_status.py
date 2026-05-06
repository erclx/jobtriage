from pathlib import Path

import pytest
from typer.testing import CliRunner

from jobtriage.cli import app


@pytest.fixture
def runner() -> CliRunner:
    return CliRunner()


def test_mark_status_writes_row_to_log(runner: CliRunner, tmp_path: Path) -> None:
    log = tmp_path / 'log.md'
    result = runner.invoke(
        app,
        [
            'mark-status',
            'ad-42',
            'applied',
            '--note',
            'submitted via portal',
            '--log',
            str(log),
        ],
    )

    assert result.exit_code == 0, result.output
    text = log.read_text(encoding='utf-8')
    assert 'ad-42' in text
    assert 'applied' in text
    assert 'submitted via portal' in text


def test_mark_status_rejects_unknown_status(runner: CliRunner, tmp_path: Path) -> None:
    log = tmp_path / 'log.md'
    result = runner.invoke(
        app,
        ['mark-status', 'ad-42', 'pondering', '--log', str(log)],
    )
    assert result.exit_code != 0

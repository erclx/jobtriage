"""Tests for the sweep CLI command."""

from collections.abc import Callable
from pathlib import Path

import pytest
from typer.testing import CliRunner

from jobtriage.cli import app
from jobtriage.jobtech.models import Ad
from jobtriage.storage.db import connect

AdFactory = Callable[..., Ad]


@pytest.fixture
def runner() -> CliRunner:
    return CliRunner()


def test_sweep_requires_at_least_one_filter(runner: CliRunner, tmp_path: Path) -> None:
    result = runner.invoke(app, ['sweep', '--db', str(tmp_path / 'db.sqlite')])
    assert result.exit_code != 0
    assert 'At least one' in result.output


def test_sweep_persists_ads_through_cli(
    runner: CliRunner,
    tmp_path: Path,
    make_ad: AdFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db_path = tmp_path / 'db.sqlite'
    fake_ads = [make_ad(ad_id='a'), make_ad(ad_id='b')]

    async def fake_collect(*_args: object, **_kwargs: object) -> list[Ad]:
        return fake_ads

    monkeypatch.setattr('jobtriage.cli.sweep.collect_ads', fake_collect)

    result = runner.invoke(
        app,
        ['sweep', '--occupation-code', 'occ-1', '--db', str(db_path)],
    )

    assert result.exit_code == 0, result.output
    assert 'inserted=2' in result.output

    conn = connect(db_path)
    try:
        ids = {row['id'] for row in conn.execute('SELECT id FROM ads').fetchall()}
    finally:
        conn.close()
    assert ids == {'a', 'b'}


def test_sweep_exits_nonzero_on_api_error(
    runner: CliRunner,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from jobtriage.errors import JobTechAPIError

    async def fake_collect(*_args: object, **_kwargs: object) -> list[Ad]:
        raise JobTechAPIError(503, 'service unavailable')

    monkeypatch.setattr('jobtriage.cli.sweep.collect_ads', fake_collect)

    result = runner.invoke(
        app,
        ['sweep', '--occupation-code', 'occ-1', '--db', str(tmp_path / 'db.sqlite')],
    )
    assert result.exit_code == 2

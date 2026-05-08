"""Tests for GET /v1/engagements/status."""

from collections.abc import Iterator
from datetime import date
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from jobtriage.api.dependencies import get_engagement_log_path
from jobtriage.engagement import Status, record_status


@pytest.fixture
def log_path(tmp_path: Path, app: FastAPI) -> Iterator[Path]:
    target = tmp_path / 'log.md'
    app.dependency_overrides[get_engagement_log_path] = lambda: target
    yield target
    app.dependency_overrides.pop(get_engagement_log_path, None)


def test_status_returns_entries_when_present(
    client: TestClient, log_path: Path
) -> None:
    record_status(
        log_path,
        ad_id='stockholm',
        status=Status.SHORTLISTED,
        note='strong match',
        today=date(2026, 5, 7),
    )

    response = client.get('/v1/engagements/status', params={'ad_id': 'stockholm'})

    assert response.status_code == 200
    body = response.json()
    assert body['ad_id'] == 'stockholm'
    assert body['entries'] == [
        {
            'recorded_on': '2026-05-07',
            'status': 'shortlisted',
            'note': 'strong match',
        }
    ]


def test_status_returns_empty_when_no_log(client: TestClient, log_path: Path) -> None:
    assert not log_path.exists()
    response = client.get('/v1/engagements/status', params={'ad_id': 'stockholm'})

    assert response.status_code == 200
    assert response.json() == {'ad_id': 'stockholm', 'entries': []}


def test_status_returns_empty_when_ad_id_not_logged(
    client: TestClient, log_path: Path
) -> None:
    record_status(
        log_path,
        ad_id='goteborg',
        status=Status.APPLIED,
        today=date(2026, 5, 7),
    )

    response = client.get('/v1/engagements/status', params={'ad_id': 'stockholm'})

    assert response.status_code == 200
    assert response.json()['entries'] == []


def test_status_rejects_blank_ad_id(client: TestClient) -> None:
    response = client.get('/v1/engagements/status', params={'ad_id': ''})

    assert response.status_code == 422

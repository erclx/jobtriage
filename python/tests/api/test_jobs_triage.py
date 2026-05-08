"""Tests for POST /v1/jobs/triage."""

import pytest
from fastapi.testclient import TestClient

from jobtriage.api import dependencies


def test_triage_ranks_relevant_ad_with_excerpt(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/triage',
        json={'query': 'Stockholm agent', 'top_k': 2},
    )

    assert response.status_code == 200
    results = response.json()['results']
    assert results[0]['ad_id'] == 'stockholm'
    assert results[0]['description_excerpt']
    assert results[0]['score'] > 0


def test_triage_drops_results_below_rrf_floor(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv('JOBTRIAGE_RRF_FLOOR', '1.0')
    dependencies.get_settings.cache_clear()

    response = client.post(
        '/v1/jobs/triage',
        json={'query': 'Stockholm agent', 'top_k': 2},
    )

    dependencies.get_settings.cache_clear()
    assert response.status_code == 200
    assert response.json() == {'results': []}


def test_triage_rejects_top_k_above_cap(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/triage',
        json={'query': 'Stockholm', 'top_k': 999},
    )

    assert response.status_code == 422


def test_triage_rejects_empty_query(client: TestClient) -> None:
    response = client.post('/v1/jobs/triage', json={'query': '', 'top_k': 3})

    assert response.status_code == 422


def test_triage_rejects_extra_fields(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/triage',
        json={'query': 'Stockholm', 'top_k': 2, 'rerank': True},
    )

    assert response.status_code == 422

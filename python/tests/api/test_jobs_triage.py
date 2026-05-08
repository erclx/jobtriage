"""Tests for POST /v1/jobs/triage."""

from fastapi.testclient import TestClient


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

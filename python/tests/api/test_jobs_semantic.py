"""Tests for POST /v1/jobs/semantic."""

from fastapi.testclient import TestClient


def test_semantic_search_ranks_relevant_ad_first(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/semantic',
        json={'query': 'Stockholm agent', 'top_k': 2},
    )

    assert response.status_code == 200
    results = response.json()['results']
    assert results[0]['ad_id'] == 'stockholm'
    assert isinstance(results[0]['score'], float)
    assert results[0]['score'] > 0


def test_semantic_search_rejects_empty_query(client: TestClient) -> None:
    response = client.post('/v1/jobs/semantic', json={'query': '', 'top_k': 5})

    assert response.status_code == 422


def test_semantic_search_rejects_missing_query(client: TestClient) -> None:
    response = client.post('/v1/jobs/semantic', json={'top_k': 5})

    assert response.status_code == 422


def test_semantic_search_rejects_extra_fields(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/semantic',
        json={'query': 'Stockholm', 'top_k': 5, 'rerank': True},
    )

    assert response.status_code == 422

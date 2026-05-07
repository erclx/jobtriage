"""Tests for POST /v1/jobs/search."""

from fastapi.testclient import TestClient


def test_search_filters_by_occupation_concept_id(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/search',
        json={'occupation_concept_id': 'occ-ai', 'top_k': 5},
    )

    assert response.status_code == 200
    body = response.json()
    assert [ad['ad_id'] for ad in body['results']] == ['stockholm']
    assert body['results'][0]['headline'] == 'Senior AI engineer'


def test_search_returns_empty_when_filter_matches_nothing(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/search',
        json={'occupation_concept_id': 'occ-missing', 'top_k': 5},
    )

    assert response.status_code == 200
    assert response.json() == {'results': []}


def test_search_rejects_extra_fields(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/search',
        json={'occupation_concept_id': 'occ-ai', 'unexpected': True},
    )

    assert response.status_code == 422


def test_search_rejects_top_k_above_cap(client: TestClient) -> None:
    response = client.post('/v1/jobs/search', json={'top_k': 999})

    assert response.status_code == 422

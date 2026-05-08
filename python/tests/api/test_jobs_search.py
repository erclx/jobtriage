"""Tests for POST /v1/jobs/search."""

from fastapi.testclient import TestClient


def test_search_filters_by_occupation_concept_id(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/search',
        json={'occupation_concept_id': 'X9jv_K2b_m48', 'top_k': 5},
    )

    assert response.status_code == 200
    body = response.json()
    assert [ad['ad_id'] for ad in body['results']] == ['stockholm']
    assert body['results'][0]['headline'] == 'Senior AI engineer'


def test_search_returns_empty_when_filter_matches_nothing(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/search',
        json={'occupation_concept_id': 'aaaa_bbb_ccc', 'top_k': 5},
    )

    assert response.status_code == 200
    assert response.json() == {'results': []}


def test_search_rejects_extra_fields(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/search',
        json={'occupation_concept_id': 'X9jv_K2b_m48', 'unexpected': True},
    )

    assert response.status_code == 422


def test_search_rejects_top_k_above_cap(client: TestClient) -> None:
    response = client.post('/v1/jobs/search', json={'top_k': 999})

    assert response.status_code == 422


def test_search_rejects_fabricated_concept_id(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/search',
        json={'occupation_concept_id': 'occupation-12345', 'top_k': 5},
    )

    assert response.status_code == 422
    detail = response.json()['detail']
    assert any('occupation_concept_id' in str(item) for item in detail), detail


def test_search_rejects_short_concept_id(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/search',
        json={'occupation_concept_id': 'occ-ai', 'top_k': 5},
    )

    assert response.status_code == 422

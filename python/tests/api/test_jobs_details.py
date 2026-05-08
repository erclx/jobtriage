"""Tests for POST /v1/jobs/details."""

from fastapi.testclient import TestClient


def test_details_returns_ad_detail_with_description_excerpt(
    client: TestClient,
) -> None:
    response = client.post('/v1/jobs/details', json={'ad_ids': ['stockholm']})

    assert response.status_code == 200
    results = response.json()['results']
    assert len(results) == 1
    assert results[0]['ad_id'] == 'stockholm'
    assert results[0]['description_excerpt']
    assert 'Stockholm' in results[0]['description_excerpt']


def test_details_preserves_input_order(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/details',
        json={'ad_ids': ['goteborg', 'stockholm']},
    )

    assert response.status_code == 200
    ids = [ad['ad_id'] for ad in response.json()['results']]
    assert ids == ['goteborg', 'stockholm']


def test_details_returns_404_when_ad_id_unknown(client: TestClient) -> None:
    response = client.post('/v1/jobs/details', json={'ad_ids': ['missing']})

    assert response.status_code == 404


def test_details_rejects_empty_ad_ids(client: TestClient) -> None:
    response = client.post('/v1/jobs/details', json={'ad_ids': []})

    assert response.status_code == 422


def test_details_rejects_extra_fields(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/details',
        json={'ad_ids': ['stockholm'], 'unexpected': True},
    )

    assert response.status_code == 422

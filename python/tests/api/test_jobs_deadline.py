"""Tests for POST /v1/jobs/deadline."""

from fastapi.testclient import TestClient


def test_deadline_returns_ads_within_window_ordered_ascending(
    client: TestClient,
) -> None:
    response = client.post('/v1/jobs/deadline', json={'window_days': 60})

    assert response.status_code == 200
    results = response.json()['results']
    assert {ad['ad_id'] for ad in results} == {'stockholm', 'goteborg'}
    deadlines = [ad['application_deadline'] for ad in results]
    assert deadlines == sorted(deadlines)
    assert all(ad['days_until_deadline'] >= 0 for ad in results)


def test_deadline_returns_empty_for_zero_window(client: TestClient) -> None:
    response = client.post('/v1/jobs/deadline', json={'window_days': 1})

    assert response.status_code == 200
    assert response.json() == {'results': []}


def test_deadline_filters_by_region(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/deadline',
        json={'window_days': 60, 'region': 'reg-stockholm'},
    )

    assert response.status_code == 200
    ids = [ad['ad_id'] for ad in response.json()['results']]
    assert ids == ['stockholm']


def test_deadline_rejects_window_above_cap(client: TestClient) -> None:
    response = client.post('/v1/jobs/deadline', json={'window_days': 999})

    assert response.status_code == 422


def test_deadline_rejects_extra_fields(client: TestClient) -> None:
    response = client.post(
        '/v1/jobs/deadline',
        json={'window_days': 30, 'unexpected': True},
    )

    assert response.status_code == 422

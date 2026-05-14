"""Tests for POST /v1/jobs/live-details partial-failure handling."""

from fastapi.testclient import TestClient
from pytest_httpx import HTTPXMock

JOBTECH_BASE_URL = 'https://jobsearch.api.jobtechdev.se'


def _ad_payload(ad_id: str) -> dict[str, object]:
    return {
        'id': ad_id,
        'headline': f'Role {ad_id}',
        'description': {'text': f'Body for {ad_id}'},
        'employer': {'name': 'Acme'},
        'workplace_address': {'municipality': 'Stockholm'},
    }


def test_live_details_returns_partial_results_on_upstream_5xx(
    client: TestClient, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_response(
        url=f'{JOBTECH_BASE_URL}/ad/ok-1',
        json=_ad_payload('ok-1'),
    )
    httpx_mock.add_response(
        url=f'{JOBTECH_BASE_URL}/ad/boom',
        status_code=503,
        text='upstream broken',
    )
    httpx_mock.add_response(
        url=f'{JOBTECH_BASE_URL}/ad/ok-2',
        json=_ad_payload('ok-2'),
    )

    response = client.post(
        '/v1/jobs/live-details', json={'ad_ids': ['ok-1', 'boom', 'ok-2']}
    )

    assert response.status_code == 200
    body = response.json()
    assert [ad['ad_id'] for ad in body['results']] == ['ok-1', 'ok-2']
    assert body['errors'] == [{'ad_id': 'boom', 'error': 'Upstream JobTech API error.'}]


def test_live_details_reports_404_ads_as_errors(
    client: TestClient, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_response(
        url=f'{JOBTECH_BASE_URL}/ad/known',
        json=_ad_payload('known'),
    )
    httpx_mock.add_response(
        url=f'{JOBTECH_BASE_URL}/ad/missing',
        status_code=404,
        text='not found',
    )

    response = client.post(
        '/v1/jobs/live-details', json={'ad_ids': ['known', 'missing']}
    )

    assert response.status_code == 200
    body = response.json()
    assert [ad['ad_id'] for ad in body['results']] == ['known']
    assert body['errors'] == [{'ad_id': 'missing', 'error': 'Ad not found.'}]


def test_live_details_returns_404_when_every_ad_fails(
    client: TestClient, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_response(
        url=f'{JOBTECH_BASE_URL}/ad/gone-1',
        status_code=404,
    )
    httpx_mock.add_response(
        url=f'{JOBTECH_BASE_URL}/ad/gone-2',
        status_code=503,
    )

    response = client.post(
        '/v1/jobs/live-details', json={'ad_ids': ['gone-1', 'gone-2']}
    )

    assert response.status_code == 404

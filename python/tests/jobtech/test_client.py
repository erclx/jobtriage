import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from pytest_httpx import HTTPXMock

from jobtriage.errors import JobTechAPIError
from jobtriage.jobtech.client import JobTechClient, SearchFilter, collect_ads

BASE_URL = 'https://jobsearch.api.jobtechdev.se'


def _ad_payload(ad_id: str, *, deadline_days: int = 14) -> dict[str, object]:
    deadline = (datetime.now(UTC) + timedelta(days=deadline_days)).isoformat()
    return {
        'id': ad_id,
        'headline': f'Role {ad_id}',
        'description': {'text': f'Body for {ad_id}'},
        'application_deadline': deadline,
        'employer': {'name': 'Acme'},
        'workplace_address': {'municipality': 'Stockholm', 'region': 'Stockholm'},
        'occupation': {'label': 'Dev', 'concept_id': 'occ-1'},
    }


async def test_search_sends_filter_params(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url=f'{BASE_URL}/search?occupation-concept-id=occ-1&region=r-1&limit=100&offset=0',
        json={'hits': [_ad_payload('a')], 'total': {'value': 1}},
    )

    async with JobTechClient(BASE_URL) as client:
        ads = await collect_ads(
            client, SearchFilter(occupation_code='occ-1', region='r-1')
        )

    assert [ad.id for ad in ads] == ['a']


async def test_search_paginates_until_short_page(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url=f'{BASE_URL}/search?occupation-concept-id=occ-1&limit=2&offset=0',
        json={'hits': [_ad_payload('a'), _ad_payload('b')], 'total': {'value': 3}},
    )
    httpx_mock.add_response(
        url=f'{BASE_URL}/search?occupation-concept-id=occ-1&limit=2&offset=2',
        json={'hits': [_ad_payload('c')], 'total': {'value': 3}},
    )

    async with JobTechClient(BASE_URL) as client:
        ads = await collect_ads(
            client, SearchFilter(occupation_code='occ-1'), page_size=2
        )

    assert [ad.id for ad in ads] == ['a', 'b', 'c']


async def test_search_filters_expired_deadlines(httpx_mock: HTTPXMock) -> None:
    expired = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    httpx_mock.add_response(
        url=f'{BASE_URL}/search?occupation-concept-id=occ-1&limit=100&offset=0',
        json={
            'hits': [
                _ad_payload('fresh', deadline_days=10),
                {**_ad_payload('stale'), 'application_deadline': expired},
            ],
            'total': {'value': 2},
        },
    )

    async with JobTechClient(BASE_URL) as client:
        ads = await collect_ads(client, SearchFilter(occupation_code='occ-1'))

    assert [ad.id for ad in ads] == ['fresh']


async def test_search_raises_on_http_error(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url=f'{BASE_URL}/search?occupation-concept-id=occ-1&limit=100&offset=0',
        status_code=502,
        text='upstream broken',
    )

    async with JobTechClient(BASE_URL) as client:
        with pytest.raises(JobTechAPIError) as excinfo:
            await collect_ads(client, SearchFilter(occupation_code='occ-1'))

    assert excinfo.value.status_code == 502


async def test_search_uses_injected_client(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url=f'{BASE_URL}/search?employer=Acme&limit=100&offset=0',
        json={'hits': [], 'total': {'value': 0}},
    )

    transport_client = httpx.AsyncClient()
    try:
        client = JobTechClient(BASE_URL, client=transport_client)
        ads = await collect_ads(client, SearchFilter(employer='Acme'))
    finally:
        await transport_client.aclose()

    assert ads == []


def test_filter_signature_is_stable() -> None:
    f = SearchFilter(occupation_code='occ-1', region='r-1')
    assert f.signature() == 'occ=occ-1|region=r-1|deadline=|employer='


def test_signatures_differ_across_filters() -> None:
    a = SearchFilter(occupation_code='occ-1')
    b = SearchFilter(occupation_code='occ-2')
    assert a.signature() != b.signature()


def test_payload_round_trip() -> None:
    body = json.dumps({'hits': [_ad_payload('round-trip')], 'total': {'value': 1}})
    from jobtriage.jobtech.models import SearchResponse

    parsed = SearchResponse.model_validate_json(body)
    assert parsed.hits[0].description_text == 'Body for round-trip'

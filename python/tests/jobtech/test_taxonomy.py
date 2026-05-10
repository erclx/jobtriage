"""Tests for taxonomy concept lookup and live JobTech search."""

import pytest
from pytest_httpx import HTTPXMock

from jobtriage.jobtech.client import (
    DEFAULT_TAXONOMY_BASE_URL,
    Concept,
    JobTechClient,
)

SEARCH_BASE_URL = 'https://jobsearch.api.jobtechdev.se'


async def test_search_concepts_maps_occupation_and_region_results(
    httpx_mock: HTTPXMock,
) -> None:
    httpx_mock.add_response(
        url=(
            f'{DEFAULT_TAXONOMY_BASE_URL}/v1/taxonomy/suggesters/autocomplete'
            '?query-string=sjukskoterska&offset=0&limit=5&type=occupation-name'
        ),
        json=[
            {
                'taxonomy/id': 'X9jv_K2b_m48',
                'taxonomy/preferred-label': 'Sjuksköterska',
                'taxonomy/type': 'occupation-name',
            },
        ],
    )
    httpx_mock.add_response(
        url=(
            f'{DEFAULT_TAXONOMY_BASE_URL}/v1/taxonomy/suggesters/autocomplete'
            '?query-string=sjukskoterska&offset=0&limit=5&type=region'
        ),
        json=[
            {
                'taxonomy/id': 'AvNB_uwa_6n6',
                'taxonomy/preferred-label': 'Stockholms län',
                'taxonomy/type': 'region',
            },
        ],
    )

    async with JobTechClient(SEARCH_BASE_URL) as client:
        concepts = await client.search_concepts('sjukskoterska', limit=5)

    assert concepts == [
        Concept(
            concept_id='X9jv_K2b_m48',
            preferred_label='Sjuksköterska',
            type='occupation',
        ),
        Concept(
            concept_id='AvNB_uwa_6n6',
            preferred_label='Stockholms län',
            type='region',
        ),
    ]


async def test_search_concepts_returns_empty_for_blank_query() -> None:
    async with JobTechClient(SEARCH_BASE_URL) as client:
        concepts = await client.search_concepts('   ', limit=5)

    assert concepts == []


async def test_live_search_returns_ads_with_excerpt(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url=(
            f'{SEARCH_BASE_URL}/search?limit=2&offset=0&q=nurse'
            '&occupation-name=X9jv_K2b_m48'
        ),
        json={
            'hits': [
                {
                    'id': 'live-1',
                    'headline': 'Sjuksköterska, Stockholm',
                    'description': {'text': 'Vi söker en erfaren sjuksköterska...'},
                    'employer': {'name': 'Region Stockholm'},
                    'workplace_address': {'municipality': 'Stockholm'},
                },
            ],
            'total': {'value': 1},
        },
    )

    async with JobTechClient(SEARCH_BASE_URL) as client:
        ads = await client.live_search(
            query='nurse',
            occupation_concept_id='X9jv_K2b_m48',
            region=None,
            limit=2,
        )

    assert [ad.id for ad in ads] == ['live-1']
    assert ads[0].description_text.startswith('Vi söker')


async def test_fetch_ad_returns_none_on_404(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url=f'{SEARCH_BASE_URL}/ad/missing',
        status_code=404,
        text='not found',
    )

    async with JobTechClient(SEARCH_BASE_URL) as client:
        ad = await client.fetch_ad('missing')

    assert ad is None


def test_lookup_request_rejects_empty_query() -> None:
    from jobtriage.api.schemas import LookupConceptRequest

    with pytest.raises(ValueError):
        LookupConceptRequest.model_validate({'query': ''})


def test_live_search_request_rejects_fabricated_concept_id() -> None:
    from jobtriage.api.schemas import LiveJobSearchRequest

    with pytest.raises(ValueError):
        LiveJobSearchRequest.model_validate(
            {'query': 'nurse', 'occupation_concept_id': 'occ-1234'}
        )

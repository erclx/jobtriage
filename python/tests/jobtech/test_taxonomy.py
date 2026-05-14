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
    httpx_mock.add_response(
        url=(
            f'{DEFAULT_TAXONOMY_BASE_URL}/v1/taxonomy/suggesters/autocomplete'
            '?query-string=sjukskoterska&offset=0&limit=5&type=municipality'
        ),
        json=[],
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


async def test_search_concepts_returns_municipalities_as_region_kind(
    httpx_mock: HTTPXMock,
) -> None:
    httpx_mock.add_response(
        url=(
            f'{DEFAULT_TAXONOMY_BASE_URL}/v1/taxonomy/suggesters/autocomplete'
            '?query-string=goteborg&offset=0&limit=5&type=occupation-name'
        ),
        json=[],
    )
    httpx_mock.add_response(
        url=(
            f'{DEFAULT_TAXONOMY_BASE_URL}/v1/taxonomy/suggesters/autocomplete'
            '?query-string=goteborg&offset=0&limit=5&type=region'
        ),
        json=[],
    )
    httpx_mock.add_response(
        url=(
            f'{DEFAULT_TAXONOMY_BASE_URL}/v1/taxonomy/suggesters/autocomplete'
            '?query-string=goteborg&offset=0&limit=5&type=municipality'
        ),
        json=[
            {
                'taxonomy/id': 'PVZL_BQT_XtL',
                'taxonomy/preferred-label': 'Göteborg',
                'taxonomy/type': 'municipality',
            },
        ],
    )

    async with JobTechClient(SEARCH_BASE_URL) as client:
        concepts = await client.search_concepts('goteborg', limit=5)

    assert concepts == [
        Concept(
            concept_id='PVZL_BQT_XtL',
            preferred_label='Göteborg',
            type='region',
        ),
    ]


async def test_search_concepts_interleaves_occupation_and_region_buckets(
    httpx_mock: HTTPXMock,
) -> None:
    occupation_hits = [
        {
            'taxonomy/id': f'OCC{idx}_AAA_BBB',
            'taxonomy/preferred-label': f'Occ {idx}',
            'taxonomy/type': 'occupation-name',
        }
        for idx in range(5)
    ]
    region_hits = [
        {
            'taxonomy/id': f'REG{idx}_AAA_BBB',
            'taxonomy/preferred-label': f'Region {idx}',
            'taxonomy/type': 'region',
        }
        for idx in range(2)
    ]
    municipality_hits = [
        {
            'taxonomy/id': f'MUN{idx}_AAA_BBB',
            'taxonomy/preferred-label': f'Kommun {idx}',
            'taxonomy/type': 'municipality',
        }
        for idx in range(3)
    ]
    httpx_mock.add_response(
        url=(
            f'{DEFAULT_TAXONOMY_BASE_URL}/v1/taxonomy/suggesters/autocomplete'
            '?query-string=stockholm&offset=0&limit=6&type=occupation-name'
        ),
        json=occupation_hits,
    )
    httpx_mock.add_response(
        url=(
            f'{DEFAULT_TAXONOMY_BASE_URL}/v1/taxonomy/suggesters/autocomplete'
            '?query-string=stockholm&offset=0&limit=6&type=region'
        ),
        json=region_hits,
    )
    httpx_mock.add_response(
        url=(
            f'{DEFAULT_TAXONOMY_BASE_URL}/v1/taxonomy/suggesters/autocomplete'
            '?query-string=stockholm&offset=0&limit=6&type=municipality'
        ),
        json=municipality_hits,
    )

    async with JobTechClient(SEARCH_BASE_URL) as client:
        concepts = await client.search_concepts('stockholm', limit=6)

    types = [concept.type for concept in concepts]
    assert types.count('occupation') >= 1
    assert types.count('region') >= 1
    assert len(concepts) == 6
    # First two entries alternate between the occupation and region buckets,
    # so neither kind is fully clipped even when occupations saturate `limit`.
    assert types[0] == 'occupation'
    assert types[1] == 'region'


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


async def test_live_search_fans_out_region_and_municipality(
    httpx_mock: HTTPXMock,
) -> None:
    httpx_mock.add_response(
        url=(f'{SEARCH_BASE_URL}/search?limit=2&offset=0&q=nurse&region=PVZL_BQT_XtL'),
        json={'hits': [], 'total': {'value': 0}},
    )
    httpx_mock.add_response(
        url=(
            f'{SEARCH_BASE_URL}/search?limit=2&offset=0&q=nurse'
            '&municipality=PVZL_BQT_XtL'
        ),
        json={
            'hits': [
                {
                    'id': 'live-2',
                    'headline': 'Sjuksköterska, Göteborg',
                    'description': {'text': 'Vi söker en erfaren sjuksköterska...'},
                    'employer': {'name': 'Region Västra Götaland'},
                    'workplace_address': {'municipality': 'Göteborg'},
                },
            ],
            'total': {'value': 1},
        },
    )

    async with JobTechClient(SEARCH_BASE_URL) as client:
        ads = await client.live_search(
            query='nurse',
            occupation_concept_id=None,
            region='PVZL_BQT_XtL',
            limit=2,
        )

    assert [ad.id for ad in ads] == ['live-2']


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

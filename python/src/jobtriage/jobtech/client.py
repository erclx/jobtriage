"""Async HTTPX client for the JobTech JobSearch and Taxonomy APIs."""

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

import httpx

from jobtriage.errors import JobTechAPIError
from jobtriage.jobtech.models import Ad, SearchResponse

MAX_PAGE_SIZE = 100
DEFAULT_TAXONOMY_BASE_URL = 'https://taxonomy.api.jobtechdev.se'

ConceptKind = Literal['occupation', 'region']

_TAXONOMY_TYPES_BY_KIND: dict[ConceptKind, tuple[str, ...]] = {
    'occupation': ('occupation-name',),
    'region': ('region',),
}
_RECOGNIZED_TAXONOMY_TYPES: dict[str, ConceptKind] = {
    'occupation-name': 'occupation',
    'region': 'region',
}


@dataclass(frozen=True, slots=True)
class Concept:
    concept_id: str
    preferred_label: str
    type: ConceptKind


@dataclass(frozen=True, slots=True)
class SearchFilter:
    occupation_code: str | None = None
    region: str | None = None
    deadline_before: date | None = None
    employer: str | None = None

    def to_query(self) -> dict[str, str]:
        params: dict[str, str] = {}
        if self.occupation_code:
            params['occupation-concept-id'] = self.occupation_code
        if self.region:
            params['region'] = self.region
        if self.employer:
            params['employer'] = self.employer
        return params

    def signature(self) -> str:
        parts = [
            f'occ={self.occupation_code or ""}',
            f'region={self.region or ""}',
            f'deadline={self.deadline_before.isoformat() if self.deadline_before else ""}',
            f'employer={self.employer or ""}',
        ]
        return '|'.join(parts)


class JobTechClient:
    def __init__(
        self,
        base_url: str,
        timeout_seconds: float = 30.0,
        client: httpx.AsyncClient | None = None,
        taxonomy_base_url: str = DEFAULT_TAXONOMY_BASE_URL,
    ) -> None:
        self._base_url = base_url.rstrip('/')
        self._taxonomy_base_url = taxonomy_base_url.rstrip('/')
        self._timeout = httpx.Timeout(timeout_seconds)
        self._owned_client = client is None
        self._client = client or httpx.AsyncClient(timeout=self._timeout)

    async def __aenter__(self) -> 'JobTechClient':
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.close()

    async def close(self) -> None:
        if self._owned_client:
            await self._client.aclose()

    async def search(
        self,
        filter_: SearchFilter,
        page_size: int = MAX_PAGE_SIZE,
    ) -> AsyncIterator[Ad]:
        if page_size < 1 or page_size > MAX_PAGE_SIZE:
            raise ValueError(f'page_size must be in [1, {MAX_PAGE_SIZE}]')

        offset = 0
        while True:
            params = {
                **filter_.to_query(),
                'limit': str(page_size),
                'offset': str(offset),
            }
            response = await self._client.get(f'{self._base_url}/search', params=params)
            if response.status_code != httpx.codes.OK:
                raise JobTechAPIError(response.status_code, response.text[:200])

            payload = SearchResponse.model_validate_json(response.content)
            if not payload.hits:
                return

            for ad in payload.hits:
                if _ad_is_active(ad, filter_.deadline_before):
                    yield ad

            if len(payload.hits) < page_size:
                return
            offset += page_size

    async def live_search(
        self,
        *,
        query: str | None,
        occupation_concept_id: str | None,
        region: str | None,
        limit: int,
    ) -> list[Ad]:
        """Free-text plus structured live search against JobTech, single page.

        Returns the raw ``Ad`` records (with ``description.text`` populated) so
        callers can build summaries with excerpts in one round trip.
        """
        if limit < 1 or limit > MAX_PAGE_SIZE:
            raise ValueError(f'limit must be in [1, {MAX_PAGE_SIZE}]')

        params: list[tuple[str, str]] = [
            ('limit', str(limit)),
            ('offset', '0'),
        ]
        if query:
            params.append(('q', query))
        if occupation_concept_id:
            # JobTech's filter param for occupation-name concept ids is
            # `occupation-name`, not `occupation-concept-id`. The latter is
            # silently ignored and returns the unfiltered global corpus.
            params.append(('occupation-name', occupation_concept_id))
        if region:
            params.append(('region', region))

        response = await self._client.get(f'{self._base_url}/search', params=params)
        if response.status_code != httpx.codes.OK:
            raise JobTechAPIError(response.status_code, response.text[:200])

        payload = SearchResponse.model_validate_json(response.content)
        return [ad for ad in payload.hits if _ad_is_active(ad, None)]

    async def fetch_ad(self, ad_id: str) -> Ad | None:
        response = await self._client.get(f'{self._base_url}/ad/{ad_id}')
        if response.status_code == httpx.codes.NOT_FOUND:
            return None
        if response.status_code != httpx.codes.OK:
            raise JobTechAPIError(response.status_code, response.text[:200])
        return Ad.model_validate_json(response.content)

    async def search_concepts(
        self,
        query: str,
        limit: int = 5,
    ) -> list[Concept]:
        """Resolve a free-text term to JobTech occupation and region concepts.

        The taxonomy autocomplete endpoint accepts only one ``type`` per
        request, so this fans out to one call per kind in parallel and merges
        the results, capped at ``limit`` total entries (occupations first).
        """
        if not query.strip() or limit < 1:
            return []

        async def fetch_kind(kind: ConceptKind) -> list[Concept]:
            results: list[Concept] = []
            for taxonomy_type in _TAXONOMY_TYPES_BY_KIND[kind]:
                response = await self._client.get(
                    f'{self._taxonomy_base_url}/v1/taxonomy/suggesters/autocomplete',
                    params={
                        'query-string': query,
                        'offset': '0',
                        'limit': str(limit),
                        'type': taxonomy_type,
                    },
                )
                if response.status_code != httpx.codes.OK:
                    raise JobTechAPIError(response.status_code, response.text[:200])
                payload = response.json()
                if not isinstance(payload, list):
                    continue
                for item in payload:
                    if not isinstance(item, dict):
                        continue
                    concept_id = item.get('taxonomy/id') or item.get('id')
                    label = (
                        item.get('taxonomy/preferred-label')
                        or item.get('preferred_label')
                        or item.get('preferred-label')
                    )
                    if not isinstance(concept_id, str) or not isinstance(label, str):
                        continue
                    results.append(
                        Concept(
                            concept_id=concept_id,
                            preferred_label=label,
                            type=kind,
                        )
                    )
            return results

        occupations, regions = await asyncio.gather(
            fetch_kind('occupation'),
            fetch_kind('region'),
        )
        return [*occupations, *regions][:limit]


def _ad_is_active(ad: Ad, deadline_before: date | None) -> bool:
    deadline = ad.application_deadline
    if deadline is None:
        return True
    today = (
        datetime.now(deadline.tzinfo).date()
        if deadline.tzinfo
        else datetime.now().date()
    )
    if deadline.date() < today:
        return False
    if deadline_before is not None and deadline.date() >= deadline_before:
        return False
    return True


async def collect_ads(
    client: JobTechClient,
    filter_: SearchFilter,
    page_size: int = MAX_PAGE_SIZE,
) -> list[Ad]:
    return [ad async for ad in client.search(filter_, page_size=page_size)]

"""Async HTTPX client for the JobTech JobSearch API with structured filters."""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import date, datetime

import httpx

from jobtriage.errors import JobTechAPIError
from jobtriage.jobtech.models import Ad, SearchResponse

MAX_PAGE_SIZE = 100


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
    ) -> None:
        self._base_url = base_url.rstrip('/')
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

import sqlite3
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta

import pytest

from jobtriage.jobtech.models import (
    Ad,
    Description,
    Employer,
    OccupationCode,
    WorkplaceAddress,
)
from jobtriage.storage.db import connect_memory


@pytest.fixture
def memory_db() -> Iterator[sqlite3.Connection]:
    conn = connect_memory()
    yield conn
    conn.close()


AdFactory = Callable[..., Ad]


@pytest.fixture
def make_ad() -> AdFactory:
    def _factory(
        *,
        ad_id: str = '1',
        headline: str = 'Senior AI Engineer',
        description_text: str = 'Build agents in Stockholm.',
        deadline_offset_days: int = 14,
        employer_name: str = 'Acme AB',
        municipality: str = 'Stockholm',
        region: str = 'Stockholm',
        occupation_label: str = 'Software developer',
        occupation_concept_id: str = 'occ-1',
    ) -> Ad:
        deadline = datetime.now(UTC) + timedelta(days=deadline_offset_days)
        return Ad(
            id=ad_id,
            headline=headline,
            description=Description(text=description_text),
            application_deadline=deadline,
            employer=Employer(name=employer_name),
            workplace_address=WorkplaceAddress(
                municipality=municipality, region=region
            ),
            occupation=OccupationCode(
                label=occupation_label, concept_id=occupation_concept_id
            ),
        )

    return _factory

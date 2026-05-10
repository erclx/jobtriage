"""Request and response models for the FastAPI HTTP layer."""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_TOP_K = 50
MAX_TRIAGE_TOP_K = 10
MAX_DETAILS = 10
MAX_DEADLINE_WINDOW_DAYS = 365
MAX_LOOKUP_TOP_K = 20

ConceptType = Literal['occupation', 'region']

# JobTech taxonomy concept ids are 12-char nanoids, 4-3-3 segments separated by
# underscores (e.g. "X9jv_K2b_m48"). Reject inputs the agent fabricated.
JOBTECH_CONCEPT_ID = re.compile(r'^[A-Za-z0-9]{4}_[A-Za-z0-9]{3}_[A-Za-z0-9]{3}$')


class JobSearchRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    occupation_concept_id: str | None = Field(
        default=None,
        description=(
            'JobTech occupation concept id to filter by. Format: '
            '4-3-3 alphanumeric segments separated by underscores '
            '(e.g. "X9jv_K2b_m48").'
        ),
    )
    region: str | None = Field(
        default=None,
        description='JobTech region concept id to filter by.',
    )
    top_k: int = Field(default=10, ge=1, le=MAX_TOP_K)

    @field_validator('occupation_concept_id')
    @classmethod
    def _check_concept_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not JOBTECH_CONCEPT_ID.match(value):
            raise ValueError(
                'occupation_concept_id must be a 12-char JobTech concept id '
                "(e.g. 'X9jv_K2b_m48'). Pass an id from a prior tool result "
                'rather than inventing one.'
            )
        return value


class SemanticSearchRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    query: str = Field(min_length=1, max_length=512)
    top_k: int = Field(default=10, ge=1, le=MAX_TOP_K)


class AdSummary(BaseModel):
    model_config = ConfigDict(extra='forbid')

    ad_id: str
    headline: str
    employer_name: str | None = None
    municipality: str | None = None
    application_deadline: str | None = None
    webpage_url: str | None = None


class RankedAd(AdSummary):
    score: float


class AdDetail(AdSummary):
    description_excerpt: str
    occupation_label: str | None = None


class TriagedAd(RankedAd):
    description_excerpt: str


class DeadlineAd(AdSummary):
    days_until_deadline: int


class JobSearchResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    results: list[AdSummary]


class SemanticSearchResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    results: list[RankedAd]


class JobDetailsRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    ad_ids: list[str] = Field(min_length=1, max_length=MAX_DETAILS)


class JobDetailsResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    results: list[AdDetail]


class TriageRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    query: str = Field(min_length=1, max_length=512)
    top_k: int = Field(default=5, ge=1, le=MAX_TRIAGE_TOP_K)


class TriageResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    results: list[TriagedAd]


class DeadlineRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    window_days: int = Field(default=14, ge=1, le=MAX_DEADLINE_WINDOW_DAYS)
    region: str | None = Field(default=None)
    top_k: int = Field(default=10, ge=1, le=MAX_TOP_K)


class DeadlineResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    results: list[DeadlineAd]


class EngagementEntry(BaseModel):
    model_config = ConfigDict(extra='forbid')

    recorded_on: str
    status: str
    note: str = ''


class EngagementStatusResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    ad_id: str
    entries: list[EngagementEntry]


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    status: str
    db_path: str
    model_name: str


class LiveAdSummary(AdSummary):
    description_excerpt: str
    occupation_label: str | None = None


class LiveJobSearchRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    query: str | None = Field(default=None, max_length=512)
    occupation_concept_id: str | None = Field(default=None)
    region: str | None = Field(default=None)
    top_k: int = Field(default=5, ge=1, le=MAX_TRIAGE_TOP_K)

    @field_validator('occupation_concept_id')
    @classmethod
    def _check_occupation_concept_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not JOBTECH_CONCEPT_ID.match(value):
            raise ValueError(
                'occupation_concept_id must be a 12-char JobTech concept id '
                "(e.g. 'X9jv_K2b_m48'). Resolve via lookupConcept rather than "
                'inventing one.'
            )
        return value


class LiveJobSearchResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    results: list[LiveAdSummary]


class LiveJobDetailsRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    ad_ids: list[str] = Field(min_length=1, max_length=MAX_DETAILS)


class LiveJobDetailsResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    results: list[LiveAdSummary]


class Concept(BaseModel):
    model_config = ConfigDict(extra='forbid')

    concept_id: str
    preferred_label: str
    type: ConceptType


class LookupConceptRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    query: str = Field(min_length=1, max_length=128)
    top_k: int = Field(default=5, ge=1, le=MAX_LOOKUP_TOP_K)


class LookupConceptResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    results: list[Concept]

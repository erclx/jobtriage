"""Request and response models for the FastAPI HTTP layer."""

from pydantic import BaseModel, ConfigDict, Field

MAX_TOP_K = 50
MAX_TRIAGE_TOP_K = 10
MAX_DETAILS = 10
MAX_DEADLINE_WINDOW_DAYS = 365


class JobSearchRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    occupation_concept_id: str | None = Field(
        default=None,
        description='JobTech occupation concept id to filter by.',
    )
    region: str | None = Field(
        default=None,
        description='JobTech region concept id to filter by.',
    )
    top_k: int = Field(default=10, ge=1, le=MAX_TOP_K)


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

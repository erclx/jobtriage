"""Request and response models for the FastAPI HTTP layer."""

from pydantic import BaseModel, ConfigDict, Field

MAX_TOP_K = 50


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


class JobSearchResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    results: list[AdSummary]


class SemanticSearchResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    results: list[RankedAd]


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    status: str
    db_path: str
    model_name: str

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Employer(BaseModel):
    model_config = ConfigDict(extra='ignore')

    name: str | None = None
    organization_number: str | None = None


class WorkplaceAddress(BaseModel):
    model_config = ConfigDict(extra='ignore')

    municipality: str | None = None
    region: str | None = None
    country: str | None = None


class OccupationCode(BaseModel):
    model_config = ConfigDict(extra='ignore')

    concept_id: str | None = None
    label: str | None = None
    legacy_ams_taxonomy_id: str | None = None


class Description(BaseModel):
    model_config = ConfigDict(extra='ignore')

    text: str | None = None


class Ad(BaseModel):
    model_config = ConfigDict(extra='ignore')

    id: str
    headline: str
    description: Description = Field(default_factory=Description)
    application_deadline: datetime | None = None
    publication_date: datetime | None = None
    last_publication_date: datetime | None = None
    webpage_url: str | None = None
    employer: Employer | None = None
    workplace_address: WorkplaceAddress | None = None
    occupation: OccupationCode | None = None

    @property
    def description_text(self) -> str:
        return self.description.text or ''


class SearchResponse(BaseModel):
    model_config = ConfigDict(extra='ignore')

    total: dict[str, int] = Field(default_factory=dict)
    hits: list[Ad] = Field(default_factory=list)

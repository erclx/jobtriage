"""Pydantic settings loaded from JOBTRIAGE_-prefixed environment variables."""

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix='JOBTRIAGE_',
        env_file='.env',
        extra='ignore',
    )

    jobtech_base_url: str = Field(default='https://jobsearch.api.jobtechdev.se')
    jobtech_timeout_seconds: float = Field(default=30.0, gt=0)
    db_path: Path = Field(default=Path('jobtriage.db'))
    engagement_log_path: Path = Field(default=Path('engagements/log.md'))
    # Drop hybrid retrieval results below this RRF score at the triage and
    # semantic boundaries. Picked from pass-1 audit observations on the seed
    # corpus where adversarial queries returned cards at ~0.016 to 0.032; 0.025
    # sits just above the noise floor for that corpus. RRF is corpus-size
    # dependent so this is exposed for retuning rather than hardcoded.
    rrf_floor: float = Field(default=0.025, ge=0.0)


def load_settings() -> Settings:
    return Settings()

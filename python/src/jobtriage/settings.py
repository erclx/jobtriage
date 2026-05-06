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


def load_settings() -> Settings:
    return Settings()

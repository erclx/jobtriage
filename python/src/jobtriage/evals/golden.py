"""Golden-set loader for the hybrid retrieval eval."""

from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field


class GoldenQuery(BaseModel):
    model_config = ConfigDict(extra='forbid')

    query: str = Field(min_length=1)
    expected_ad_ids: list[str] = Field(min_length=1)
    note: str | None = None


class GoldenSet(BaseModel):
    model_config = ConfigDict(extra='forbid')

    queries: list[GoldenQuery] = Field(min_length=1)


def load_golden_set(path: Path) -> GoldenSet:
    raw = yaml.safe_load(path.read_text(encoding='utf-8'))
    if not isinstance(raw, dict):
        raise ValueError(f'golden set at {path} must be a mapping')
    return GoldenSet.model_validate(raw)

"""Verify the OpenAPI schema covers the endpoints the frontend will call."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

OPENAPI_PATH = Path(__file__).resolve().parents[2] / 'openapi.json'


def test_openapi_endpoint_exposes_registered_routes(client: TestClient) -> None:
    response = client.get('/openapi.json')

    assert response.status_code == 200
    schema = response.json()
    paths = schema['paths']
    assert '/healthz' in paths
    assert '/v1/jobs/search' in paths
    assert '/v1/jobs/semantic' in paths


def test_checked_in_openapi_json_matches_runtime_schema(client: TestClient) -> None:
    runtime = client.get('/openapi.json').json()
    on_disk = json.loads(OPENAPI_PATH.read_text(encoding='utf-8'))

    assert runtime == on_disk, (
        'python/openapi.json is stale. Regenerate via '
        '`uv run python scripts/export_openapi.py`.'
    )

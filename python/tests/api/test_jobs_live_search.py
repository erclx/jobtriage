"""Tests for POST /v1/jobs/live-search input validation."""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.parametrize(
    'payload',
    [
        {},
        {'region': 'reg-vastra'},
        {'top_k': 5},
    ],
    ids=['empty', 'region_only', 'top_k_only'],
)
def test_live_search_rejects_input_without_query_or_concept_id(
    client: TestClient, payload: dict[str, object]
) -> None:
    response = client.post('/v1/jobs/live-search', json=payload)

    assert response.status_code == 422
    body = response.json()
    detail = body.get('detail')
    rendered = str(detail)
    assert 'lookupConcept' in rendered
    assert 'query' in rendered

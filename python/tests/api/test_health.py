"""Health endpoint smoke."""

from fastapi.testclient import TestClient


def test_healthz_reports_runtime_configuration(client: TestClient) -> None:
    response = client.get('/healthz')

    assert response.status_code == 200
    body = response.json()
    assert body['status'] == 'ok'
    assert body['db_path'].endswith('jobtriage.db')
    assert body['model_name']

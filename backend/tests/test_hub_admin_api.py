from pathlib import Path

import pytest
from app.core.config import Settings, get_settings
from app.main import create_app
from fastapi.testclient import TestClient
from pydantic import ValidationError

TOKEN = "local-hub-token-for-contract-tests"
BASE_HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "X-Hub-Audience": "central",
    "X-Hub-Scopes": "hub:observe",
    "X-Hub-Service": "central",
}


@pytest.fixture
def hub_client(monkeypatch):
    monkeypatch.setenv("HUB_ADMIN_TOKEN", TOKEN)
    monkeypatch.setenv("HUB_ADMIN_AUDIENCE", "central")
    monkeypatch.setenv("HUB_PRODUCT_ID", "mediamind-ai")
    monkeypatch.setenv("ENVIRONMENT", "test")
    get_settings.cache_clear()
    with TestClient(create_app(), raise_server_exceptions=False) as client:
        yield client
    get_settings.cache_clear()


def test_public_manifest_describes_the_product_without_exposing_credentials(hub_client):
    response = hub_client.get("/.well-known/hub/manifest")

    assert response.status_code == 200
    assert response.json() == {
        "product_id": "mediamind-ai",
        "display_name": "MediaMind AI",
        "product_version": Path("VERSION").read_text(encoding="utf-8").strip(),
        "admin_api_version": "v1",
        "capabilities": ["observe.health", "observe.readiness", "observe.version"],
        "endpoints": {
            "health": "/api/hub/v1/health",
            "readiness": "/api/hub/v1/readiness",
            "version": "/api/hub/v1/version",
        },
    }
    assert TOKEN not in response.text
    assert "secret" not in response.text.lower()


@pytest.mark.parametrize("path", ["health", "readiness", "version"])
def test_observation_endpoints_require_a_service_token(hub_client, path):
    response = hub_client.get(f"/api/hub/v1/{path}")

    assert response.status_code == 401
    assert response.json()["error_code"] == "HTTP_401"


def test_service_identity_rejects_wrong_audience(hub_client):
    headers = {**BASE_HEADERS, "X-Hub-Audience": "other-control-plane"}

    response = hub_client.get("/api/hub/v1/health", headers=headers)

    assert response.status_code == 403


def test_service_identity_rejects_missing_observation_scope(hub_client):
    headers = {**BASE_HEADERS, "X-Hub-Scopes": "hub:command"}

    response = hub_client.get("/api/hub/v1/health", headers=headers)

    assert response.status_code == 403


def test_authenticated_health_includes_observation_evidence(hub_client):
    response = hub_client.get(
        "/api/hub/v1/health",
        headers={**BASE_HEADERS, "X-Correlation-ID": "bridge-contract-test"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["source"] == "mediamind-ai"
    assert body["environment"] == "test"
    assert body["observed_at"].endswith("Z")
    assert response.headers["X-Correlation-ID"] == "bridge-contract-test"
    assert TOKEN not in response.text


def test_authenticated_readiness_reports_database_evidence(hub_client, monkeypatch):
    import app.api.v1.hub_admin as hub_admin

    monkeypatch.setattr(hub_admin, "database_available", lambda: True)

    response = hub_client.get("/api/hub/v1/readiness", headers=BASE_HEADERS)

    assert response.status_code == 200
    assert response.json()["checks"] == {"api": "ready", "database": "ready"}


def test_authenticated_version_identifies_product_and_api(hub_client):
    response = hub_client.get("/api/hub/v1/version", headers=BASE_HEADERS)

    assert response.status_code == 200
    assert response.json()["product_id"] == "mediamind-ai"
    assert response.json()["admin_api_version"] == "v1"
    assert response.json()["product_version"] == Path("VERSION").read_text().strip()


def test_production_requires_a_non_default_hub_admin_token():
    with pytest.raises(ValidationError, match="HUB_ADMIN_TOKEN"):
        Settings(
            _env_file=None,
            environment="production",
            database_url="postgresql+psycopg://user:password@db.example.com/mediamind",
            frontend_url="https://mediamind.example.com",
            google_redirect_uri="https://api.example.com/api/v1/auth/google/callback",
            session_cookie_secure=True,
        )

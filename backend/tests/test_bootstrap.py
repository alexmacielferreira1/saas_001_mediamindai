import re

import pytest
from app.main import create_app
from fastapi import HTTPException
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    app = create_app()

    @app.get("/_test/crash")
    def crash():
        raise RuntimeError("secret-password-and-stacktrace")

    @app.get("/_test/validate")
    def validate(number: int):
        return {"number": number}

    @app.get("/_test/denied")
    def denied():
        raise HTTPException(403, "internal secret detail")

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_health_is_liveness_without_database(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_version_comes_from_version_file(client):
    from app.core.config import ROOT

    assert client.get("/version").json()["version"] == (ROOT / "VERSION").read_text().strip()


def test_correlation_propagates_and_request_ids_are_unique(client):
    a = client.get("/health", headers={"X-Correlation-ID": "test-123"})
    b = client.get("/health", headers={"X-Correlation-ID": "test-123"})
    assert a.headers["X-Correlation-ID"] == "test-123"
    assert a.headers["X-Request-ID"] != b.headers["X-Request-ID"]


@pytest.mark.parametrize("value", ["", "a" * 200, "has spaces"])
def test_untrusted_correlation_id_is_replaced(client, value):
    response = client.get("/health", headers={"X-Correlation-ID": value})
    assert re.fullmatch(r"[a-f0-9-]{36}", response.headers["X-Correlation-ID"])


@pytest.mark.parametrize(
    "path,status,code",
    [
        ("/_test/crash", 500, "INTERNAL_ERROR"),
        ("/missing", 404, "HTTP_404"),
        ("/_test/validate?number=secret", 422, "VALIDATION_ERROR"),
        ("/_test/denied", 403, "HTTP_403"),
    ],
)
def test_error_contract_never_leaks_internal_details(client, path, status, code):
    response = client.get(path, headers={"X-Correlation-ID": "safe-id"})
    assert response.status_code == status
    data = response.json()
    assert data["error_code"] == code
    assert data["correlation_id"] == "safe-id"
    assert data["public_reference"]
    assert isinstance(data["retryable"], bool)
    assert "secret" not in response.text
    assert response.headers["X-Correlation-ID"] == "safe-id"


def test_database_readiness_is_honest(client, monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "database_available", lambda: False)
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json()["error_code"] == "DATABASE_UNAVAILABLE"


def test_database_readiness_when_available(client, monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "database_available", lambda: True)
    assert client.get("/ready").json()["database"] == "ok"


def test_method_not_allowed_preserves_protocol_headers(client):
    response = client.post("/health")
    assert response.status_code == 405
    assert "GET" in response.headers["Allow"]
    assert response.json()["error_code"] == "HTTP_405"


def test_error_reference_is_searchable_without_logging_secrets(client, caplog):
    import logging

    logger = logging.getLogger("hub")
    logger.addHandler(caplog.handler)
    try:
        response = client.get("/_test/crash?token=secret-token")
    finally:
        logger.removeHandler(caplog.handler)
    reference = response.json()["public_reference"]
    assert any(getattr(record, "public_reference", None) == reference for record in caplog.records)
    assert "secret-token" not in caplog.text
    assert "secret-password" not in caplog.text

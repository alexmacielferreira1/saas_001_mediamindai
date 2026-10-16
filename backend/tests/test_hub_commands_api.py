from uuid import uuid4

import pytest
from app.core.config import get_settings
from app.db.session import Base, get_session
from app.main import create_app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

TOKEN = "local-hub-command-token"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "X-Hub-Audience": "central",
    "X-Hub-Scopes": "hub:command",
    "X-Hub-Service": "central",
    "X-Correlation-ID": "command-contract-test",
}


@pytest.fixture
def command_client(monkeypatch):
    monkeypatch.setenv("HUB_ADMIN_TOKEN", TOKEN)
    monkeypatch.setenv("HUB_ADMIN_AUDIENCE", "central")
    monkeypatch.setenv("HUB_PRODUCT_ID", "mediamind-ai")
    monkeypatch.setenv("ENVIRONMENT", "test")
    get_settings.cache_clear()

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)

    def override_session():
        with session_factory() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, session_factory
    Base.metadata.drop_all(engine)
    engine.dispose()
    get_settings.cache_clear()


def post_command(client, action, *, dry_run=True, key=None):
    return client.post(
        "/api/hub/v1/commands",
        headers={**HEADERS, "Idempotency-Key": key or str(uuid4())},
        json={"action": action, "dry_run": dry_run, "parameters": {}},
    )


def test_system_describe_is_persisted_and_returns_only_safe_product_information(command_client):
    client, _ = command_client

    response = post_command(client, "system.describe")

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["action"] == "system.describe"
    assert body["dry_run"] is True
    assert body["correlation_id"] == "command-contract-test"
    assert body["result"] == {
        "product_id": "mediamind-ai",
        "environment": "test",
        "mode": "read_only",
    }
    fetched = client.get(f"/api/hub/v1/commands/{body['id']}", headers=HEADERS)
    assert fetched.status_code == 200
    assert fetched.json() == body
    assert TOKEN not in response.text


def test_media_count_returns_an_aggregate_without_media_payloads(command_client):
    client, _ = command_client

    response = post_command(client, "media.count")

    assert response.status_code == 202
    assert response.json()["result"] == {"assets": 0}


def test_unsupported_action_is_rejected_without_creating_a_command(command_client):
    client, session_factory = command_client

    response = post_command(client, "database.execute")

    assert response.status_code == 422
    assert command_count(session_factory) == 0


def test_non_dry_run_command_is_rejected_without_creating_a_command(command_client):
    client, session_factory = command_client

    response = post_command(client, "system.describe", dry_run=False)

    assert response.status_code == 409
    assert command_count(session_factory) == 0


def test_replayed_idempotency_key_returns_the_same_command_without_second_row(command_client):
    client, session_factory = command_client
    key = "repeat-this-command-once"

    first = post_command(client, "system.describe", key=key)
    replay = post_command(client, "system.describe", key=key)

    assert first.status_code == 202
    assert replay.status_code == 200
    assert replay.json()["id"] == first.json()["id"]
    assert command_count(session_factory) == 1


def test_idempotency_key_rejects_different_command_payload_without_second_row(command_client):
    client, session_factory = command_client
    key = "same-key-different-operation"

    first = post_command(client, "system.describe", key=key)
    conflict = post_command(client, "media.count", key=key)

    assert first.status_code == 202
    assert conflict.status_code == 409
    assert conflict.json()["error_code"] == "HUB_IDEMPOTENCY_CONFLICT"
    assert command_count(session_factory) == 1


def test_command_lookup_does_not_expose_unknown_command(command_client):
    client, _session_factory = command_client

    response = client.get(f"/api/hub/v1/commands/{uuid4()}", headers=HEADERS)

    assert response.status_code == 404
    assert response.json()["error_code"] == "HUB_COMMAND_NOT_FOUND"


def test_invalid_service_token_creates_no_command(command_client):
    client, session_factory = command_client
    headers = {**HEADERS, "Authorization": "Bearer wrong-token", "Idempotency-Key": "bad"}

    response = client.post(
        "/api/hub/v1/commands",
        headers=headers,
        json={"action": "system.describe", "dry_run": True, "parameters": {}},
    )

    assert response.status_code == 401
    assert command_count(session_factory) == 0


def command_count(session_factory) -> int:
    table = Base.metadata.tables["hub_commands"]
    with Session(session_factory.kw["bind"]) as session:
        return session.scalar(select(func.count()).select_from(table)) or 0

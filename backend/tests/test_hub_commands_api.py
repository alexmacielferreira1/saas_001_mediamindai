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
    monkeypatch.setenv("HUB_ADMIN_SCOPES", "hub:observe hub:command")
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


def test_forged_scope_header_cannot_grant_commands_to_an_observe_only_token(
    command_client, monkeypatch
):
    client, session_factory = command_client
    monkeypatch.setenv("HUB_ADMIN_SCOPES", "hub:observe")
    get_settings.cache_clear()

    response = post_command(client, "system.describe")

    assert response.status_code == 403
    assert command_count(session_factory) == 0


def test_scope_header_can_only_narrow_server_scopes(command_client):
    client, session_factory = command_client
    headers = {**HEADERS, "X-Hub-Scopes": "hub:observe", "Idempotency-Key": "narrow"}

    response = client.post(
        "/api/hub/v1/commands",
        headers=headers,
        json={"action": "system.describe", "dry_run": True, "parameters": {}},
    )

    assert response.status_code == 403
    assert command_count(session_factory) == 0


def test_commands_work_without_scope_header_using_server_scopes(command_client):
    client, _ = command_client
    headers = {key: value for key, value in HEADERS.items() if key != "X-Hub-Scopes"}

    response = client.post(
        "/api/hub/v1/commands",
        headers={**headers, "Idempotency-Key": str(uuid4())},
        json={"action": "system.describe", "dry_run": True, "parameters": {}},
    )

    assert response.status_code == 202


def central_headers(scope: str) -> dict[str, str]:
    """Exactly what the Central connector sends (connectors/hub.py `_hub_headers`)."""
    return {
        "Authorization": f"Bearer {TOKEN}",
        "X-Hub-Audience": "central",
        "X-Hub-Scopes": scope,
        "X-Hub-Service": "central",
        "X-Correlation-ID": "central-contract",
    }


def test_central_contract_headers_keep_observe_and_command_working(command_client, monkeypatch):
    import app.api.v1.hub_admin as hub_admin

    client, _ = command_client
    monkeypatch.setattr(hub_admin, "database_available", lambda: True)
    # Machine routes are bearer-authenticated: a foreign/missing Origin never blocks them.
    client.headers.pop("Origin")
    observe = central_headers("hub:observe")

    assert client.get("/.well-known/hub/manifest").status_code == 200
    for path in ("health", "readiness", "version"):
        assert client.get(f"/api/hub/v1/{path}", headers=observe).status_code == 200

    command = central_headers("hub:command")
    created = client.post(
        "/api/hub/v1/commands",
        headers={**command, "Origin": "https://evil.example.com", "Idempotency-Key": "central-1"},
        json={"action": "system.describe", "dry_run": True, "parameters": {}},
    )
    assert created.status_code == 202
    fetched = client.get(f"/api/hub/v1/commands/{created.json()['id']}", headers=command)
    assert fetched.status_code == 200
    assert fetched.json()["id"] == created.json()["id"]


def test_command_owner_is_still_the_calling_service(command_client):
    client, _ = command_client
    created = client.post(
        "/api/hub/v1/commands",
        headers={**central_headers("hub:command"), "Idempotency-Key": "owner-1"},
        json={"action": "system.describe", "dry_run": True, "parameters": {}},
    )
    other = {**central_headers("hub:command"), "X-Hub-Service": "other-service"}

    response = client.get(f"/api/hub/v1/commands/{created.json()['id']}", headers=other)

    assert response.status_code == 404


def test_central_headers_with_forged_scope_cannot_exceed_observe_only_server_config(
    command_client, monkeypatch
):
    client, session_factory = command_client
    monkeypatch.setenv("HUB_ADMIN_SCOPES", "hub:observe")
    get_settings.cache_clear()

    observe = client.get("/api/hub/v1/health", headers=central_headers("hub:observe"))
    forged = client.post(
        "/api/hub/v1/commands",
        headers={**central_headers("hub:observe hub:command"), "Idempotency-Key": "forged-2"},
        json={"action": "system.describe", "dry_run": True, "parameters": {}},
    )

    assert observe.status_code == 200
    assert forged.status_code == 403
    assert command_count(session_factory) == 0


def test_wrong_token_with_central_headers_is_rejected(command_client):
    client, _ = command_client
    headers = {**central_headers("hub:observe"), "Authorization": "Bearer other-token"}

    assert client.get("/api/hub/v1/health", headers=headers).status_code == 401


def _simulate_concurrent_insert(monkeypatch, first_body_action):
    """The first lookup misses: another request inserts the same key before our commit."""
    import app.api.v1.hub_admin as hub_admin
    from app.models.hub_command import HubCommand

    real_find = hub_admin.find_command
    calls = {"n": 0}

    def racing_find(session, service, key):
        calls["n"] += 1
        if calls["n"] == 1:
            with Session(session.get_bind()) as other:
                other.add(
                    HubCommand(
                        source_service=service,
                        idempotency_key=key,
                        action=first_body_action,
                        dry_run=True,
                        parameters={},
                        status="succeeded",
                        result={"winner": True},
                        correlation_id="first-request",
                    )
                )
                other.commit()
            return None
        return real_find(session, service, key)

    monkeypatch.setattr(hub_admin, "find_command", racing_find)
    return calls


def test_concurrent_same_key_returns_the_existing_command_instead_of_500(
    command_client, monkeypatch
):
    client, session_factory = command_client
    calls = _simulate_concurrent_insert(monkeypatch, "system.describe")

    response = post_command(client, "system.describe", key="race-key")

    assert response.status_code == 200, response.text
    assert response.json()["result"] == {"winner": True}
    assert response.json()["correlation_id"] == "first-request"
    assert calls["n"] == 2
    with session_factory() as session:
        from app.models.hub_command import HubCommand

        assert session.scalar(select(func.count()).select_from(HubCommand)) == 1


def test_concurrent_same_key_with_other_payload_is_a_clear_conflict(command_client, monkeypatch):
    client, _ = command_client
    _simulate_concurrent_insert(monkeypatch, "media.count")

    response = post_command(client, "system.describe", key="race-key")

    assert response.status_code == 409
    assert response.json()["error_code"] == "HUB_IDEMPOTENCY_CONFLICT"


def test_unexplained_integrity_error_is_not_masked_as_success(command_client, monkeypatch):
    import app.api.v1.hub_admin as hub_admin

    client, _ = command_client
    _simulate_concurrent_insert(monkeypatch, "system.describe")
    racing = hub_admin.find_command
    monkeypatch.setattr(hub_admin, "find_command", lambda *args: racing(*args) and None)

    response = post_command(client, "system.describe", key="race-key")

    assert response.status_code == 500
    assert "IntegrityError" not in response.text
    assert "UNIQUE" not in response.text

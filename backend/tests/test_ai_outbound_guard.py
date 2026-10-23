"""Auditoria 2026-10-23, achado #3: SSRF nas chamadas de IA (Copilot, MCP, imagem, Video Studio).

O destino configurado por uma empresa é validado ao salvar a conexão e novamente logo antes
de cada chamada (registros antigos podem ter sido gravados antes da validação).
"""

# ruff: noqa: F811

import pytest
from app.core.config import get_settings
from app.models.identity import TenantRecord
from cryptography.fernet import Fernet
from test_permission_groups_api import login, permission_client  # noqa: F401

INTERNAL_URLS = [
    "http://169.254.169.254/v1",
    "http://10.0.0.5:8080/v1",
    "http://localhost:11434/v1",
    "http://mediamind-db.internal/v1",
]


def connection(base_url, connection_id="main", provider="compatible"):
    return {
        "id": connection_id,
        "name": "IA",
        "provider": provider,
        "base_url": base_url,
        "model": "gpt-image-1",
        "api_key": "chave-secreta",
    }


@pytest.fixture
def ai_secret(monkeypatch):
    monkeypatch.setenv("AI_SECRET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.parametrize("base_url", INTERNAL_URLS)
def test_saving_ai_connection_rejects_internal_destinations(permission_client, ai_secret, base_url):
    client, _ids = permission_client
    login(client)
    response = client.put(
        "/api/v1/ai/connections",
        json={"connections": [connection(base_url)], "default_connection_id": "main"},
    )
    assert response.status_code == 422
    assert response.json()["error_code"] == "AI_DESTINATION_BLOCKED"

    legacy = client.patch(
        "/api/v1/ai/settings",
        json={"base_url": base_url, "model": "gpt-image-1", "api_key": "chave-secreta"},
    )
    assert legacy.status_code == 422
    assert legacy.json()["error_code"] == "AI_DESTINATION_BLOCKED"


def test_saving_public_ai_connection_still_works(permission_client, ai_secret):
    client, _ids = permission_client
    login(client)
    response = client.put(
        "/api/v1/ai/connections",
        json={
            "connections": [connection("https://provider.example.test/v1")],
            "default_connection_id": "main",
        },
    )
    assert response.status_code == 200


def test_ai_calls_refuse_internal_destination_stored_before_validation(
    permission_client, ai_secret, monkeypatch
):
    client, ids = permission_client
    login(client)
    from app.api.v1.ai import ai_cipher

    encrypted = ai_cipher().encrypt(b"chave-secreta").decode()
    stored = {**connection("http://169.254.169.254/v1"), "encrypted_key": encrypted}
    del stored["api_key"]
    with ids["session_factory"]() as session:
        session.add(
            TenantRecord(
                tenant_id=ids["tenant"],
                entity_type="AISettings",
                data={
                    "connections": [stored],
                    "default_connection_id": "main",
                    "tool_connections": {},
                },
            )
        )
        session.commit()

    calls = []

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, **_kwargs):
            calls.append(url)
            raise AssertionError("não deveria chamar destino interno")

    monkeypatch.setattr("app.api.v1.ai.httpx.AsyncClient", FakeClient)

    responses = [
        client.post("/api/v1/ai/copilot/chat", json={"message": "Oi"}),
        client.post("/api/v1/ai/generation/image", json={"prompt": "Teste"}),
        client.post(
            "/api/v1/ai/generation/video-studio", json={"stage": "roteiro", "prompt": "Ideia"}
        ),
        client.post("/api/v1/mcp/tools/ai-tools.prompt/call", json={"arguments": {"prompt": "Oi"}}),
    ]

    assert calls == []
    for response in responses:
        assert response.status_code == 422, response.text
        assert response.json()["error_code"] == "AI_DESTINATION_BLOCKED"

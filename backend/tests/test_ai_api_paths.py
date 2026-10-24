"""Caminhos de erro e isolamento de ``app.api.v1.ai`` sem alterar o código protegido."""

# ruff: noqa: F811
import asyncio
from types import SimpleNamespace

import httpx
import pytest
from app.api.v1 import ai as ai_api
from app.core.config import get_settings
from app.core.errors import PublicError
from app.models.identity import Membership, Tenant, TenantRecord, User
from cryptography.fernet import Fernet
from sqlalchemy import select
from test_permission_groups_api import login, permission_client  # noqa: F401

SECRET = "segredo-do-provedor"


@pytest.fixture
def ai_secret(monkeypatch, tmp_path):
    monkeypatch.setenv("AI_SECRET_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path / "media"))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def connection(provider="compatible", **extra):
    return {
        "id": "principal",
        "name": "Principal",
        "provider": provider,
        "base_url": (
            "https://api.anthropic.com/v1"
            if provider == "anthropic"
            else "https://provider.example.test/v1"
        ),
        "model": "modelo",
        "api_key": SECRET,
        **extra,
    }


def save_connections(client, items, **body):
    response = client.put(
        "/api/v1/ai/connections",
        json={
            "connections": items,
            "default_connection_id": items[0]["id"] if items else None,
            "tool_connections": {},
            **body,
        },
    )
    assert response.status_code == 200, response.text
    return response


class FakeResponse:
    def __init__(self, payload=None, *, status=200, invalid_json=False):
        self.payload = payload
        self.status = status
        self.invalid_json = invalid_json

    def raise_for_status(self):
        if self.status >= 400:
            request = httpx.Request("POST", "https://provider.example.test")
            raise httpx.HTTPStatusError(
                "recusado", request=request, response=httpx.Response(self.status)
            )

    def json(self):
        if self.invalid_json:
            raise ValueError("json inválido")
        return self.payload


def fake_provider(monkeypatch, outcome):
    """``outcome`` é uma FakeResponse ou uma exceção httpx levantada no POST."""

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            if isinstance(outcome, Exception):
                raise outcome
            return outcome

    monkeypatch.setattr("app.api.v1.ai.httpx.AsyncClient", lambda **_kwargs: FakeClient())


def usage_events(ids):
    with ids["session_factory"]() as session:
        return [
            row.data
            for row in session.scalars(
                select(TenantRecord).where(TenantRecord.entity_type == "AIUsageEvent")
            )
        ]


# --- escopo de empresa -----------------------------------------------------------


def test_superadmin_cannot_select_inactive_company(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        member = session.scalar(select(Membership).where(Membership.role == "admin"))
        member.role = "superadmin"
        session.get(Tenant, ids["other"]).is_active = False
        session.commit()
    login(client)

    response = client.get(f"/api/v1/ai/connections?tenant_id={ids['other']}")

    assert response.status_code == 403
    assert response.json()["error_code"] == "TENANT_ACCESS_DENIED"


def test_member_of_second_company_reads_it_only_with_that_company_permissions(
    permission_client, ai_secret
):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        admin = session.scalar(select(User).where(User.email == "admin@mediamind.ai"))
        session.add(Membership(user_id=admin.id, tenant_id=ids["other"], role="viewer"))
        session.add(
            TenantRecord(
                tenant_id=ids["other"],
                entity_type="AISettings",
                data={
                    "connections": [
                        {
                            "id": "outra",
                            "name": "Outra",
                            "provider": "compatible",
                            "base_url": "https://provider.example.test/v1",
                            "model": "m",
                            "enabled": True,
                            "encrypted_key": "cifrada",
                        }
                    ],
                    "default_connection_id": "outra",
                },
            )
        )
        session.commit()
    login(client)

    read = client.get(f"/api/v1/ai/connections?tenant_id={ids['other']}")
    write = client.put(f"/api/v1/ai/connections?tenant_id={ids['other']}", json={"connections": []})

    assert read.status_code == 200
    assert read.json()["can_manage"] is False
    assert [item["id"] for item in read.json()["connections"]] == ["outra"]
    assert "cifrada" not in read.text
    assert write.status_code == 403


# --- validação das conexões ------------------------------------------------------


@pytest.mark.parametrize(
    ("items", "extra", "code"),
    [
        ([connection(), connection()], {}, "AI_DUPLICATE_CONNECTION"),
        ([connection(name="   ")], {}, "AI_INVALID_CONNECTION"),
        ([connection()], {"default_connection_id": "inexistente"}, "AI_INVALID_ASSIGNMENT"),
        ([connection()], {"tool_connections": {"ferramenta-falsa": None}}, "AI_INVALID_TOOL"),
    ],
)
def test_invalid_connection_sets_are_rejected_without_saving(
    permission_client, ai_secret, items, extra, code
):
    client, ids = permission_client
    login(client)
    body = {"connections": items, "default_connection_id": "principal", "tool_connections": {}}

    response = client.put("/api/v1/ai/connections", json={**body, **extra})

    assert response.status_code == 422
    assert response.json()["error_code"] == code
    assert SECRET not in response.text
    with ids["session_factory"]() as session:
        saved = session.scalar(select(TenantRecord).where(TenantRecord.entity_type == "AISettings"))
        assert saved is None


# --- cofre de chaves -------------------------------------------------------------


def test_cipher_requires_secret_in_production(monkeypatch, tmp_path):
    fake = SimpleNamespace(ai_secret_key=None, environment="production", media_root=tmp_path)
    monkeypatch.setattr(ai_api, "get_settings", lambda: fake)

    with pytest.raises(PublicError) as error:
        ai_api.ai_cipher()

    assert error.value.code == "SECRET_STORAGE_NOT_CONFIGURED"
    assert not (tmp_path.parent / "ai-secret.key").exists()


def test_cipher_rejects_malformed_secret(monkeypatch):
    monkeypatch.setenv("AI_SECRET_KEY", "nao-e-uma-chave-fernet")
    get_settings.cache_clear()
    try:
        with pytest.raises(PublicError) as error:
            ai_api.ai_cipher()
    finally:
        get_settings.cache_clear()

    assert error.value.code == "SECRET_STORAGE_NOT_CONFIGURED"


def test_decrypt_requires_key_and_reports_unreadable_key(ai_secret):
    with pytest.raises(PublicError) as missing:
        ai_api.decrypt_ai_key({})
    with pytest.raises(PublicError) as unreadable:
        ai_api.decrypt_ai_key(
            {"encrypted_key": Fernet(Fernet.generate_key()).encrypt(b"x").decode()}
        )

    assert missing.value.code == "AI_PROVIDER_NOT_CONFIGURED"
    assert unreadable.value.code == "AI_KEY_UNREADABLE"


# --- geração de texto genérica (MCP/Copiloto) ------------------------------------


def stored(provider="compatible"):
    data = connection(provider)
    data.pop("api_key")
    data["encrypted_key"] = ai_api.ai_cipher().encrypt(SECRET.encode()).decode()
    return data


def test_generate_text_with_anthropic_joins_text_blocks(monkeypatch, ai_secret):
    sent = {}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, *, headers, json):
            sent.update(url=url, headers=headers, json=json)
            return FakeResponse(
                {
                    "content": [
                        {"type": "text", "text": "Parte 1"},
                        {"type": "tool_use", "text": "ignorar"},
                        {"type": "text", "text": "Parte 2"},
                    ],
                    "usage": {"input_tokens": 3},
                }
            )

    monkeypatch.setattr("app.api.v1.ai.httpx.AsyncClient", lambda **_kwargs: FakeClient())

    text, usage = asyncio.run(
        ai_api.generate_connection_text(stored("anthropic"), "Oi", return_usage=True)
    )

    assert text == "Parte 1\nParte 2"
    assert usage == {"input_tokens": 3}
    assert sent["url"] == "https://api.anthropic.com/v1/messages"
    assert sent["headers"]["x-api-key"] == SECRET


@pytest.mark.parametrize(
    ("provider", "outcome", "code"),
    [
        (
            "anthropic",
            FakeResponse({"stop_reason": "max_tokens", "content": []}),
            "AI_OUTPUT_TRUNCATED",
        ),
        (
            "compatible",
            FakeResponse({"choices": [{"finish_reason": "length", "message": {}}]}),
            "AI_OUTPUT_TRUNCATED",
        ),
        ("compatible", FakeResponse({"choices": []}), "AI_INVALID_RESPONSE"),
        ("compatible", FakeResponse({}, status=402), "AI_GENERATION_REJECTED"),
        ("compatible", httpx.ConnectError("sem rede"), "AI_PROVIDER_UNAVAILABLE"),
        ("compatible", FakeResponse(invalid_json=True), "AI_PROVIDER_UNAVAILABLE"),
    ],
)
def test_generate_text_failures_are_public_errors(monkeypatch, ai_secret, provider, outcome, code):
    fake_provider(monkeypatch, outcome)

    with pytest.raises(PublicError) as error:
        asyncio.run(ai_api.generate_connection_text(stored(provider), "Oi"))

    assert error.value.code == code
    assert SECRET not in error.value.message


# --- configuração legada (/ai/settings) ------------------------------------------


def test_legacy_settings_read_write_clear_and_require_key(permission_client, ai_secret):
    client, _ids = permission_client
    login(client)
    base = {"provider": "compatible", "base_url": "https://images.example.test/v1"}

    assert client.get("/api/v1/ai/settings").json()["key_configured"] is False
    missing_key = client.patch("/api/v1/ai/settings", json={**base, "model": "m1"})
    saved = client.patch("/api/v1/ai/settings", json={**base, "model": "m1", "api_key": SECRET})
    kept = client.patch("/api/v1/ai/settings", json={**base, "model": "m2"})
    cleared = client.patch("/api/v1/ai/settings", json={**base, "model": "m2", "clear_key": True})
    current = client.get("/api/v1/ai/settings")

    assert missing_key.status_code == 422
    assert missing_key.json()["error_code"] == "AI_KEY_REQUIRED"
    assert saved.status_code == 200
    assert kept.status_code == 200
    assert kept.json()["model"] == "m2"
    assert kept.json()["key_configured"] is True
    assert cleared.status_code == 422
    assert current.json()["model"] == "m2"
    assert current.json()["key_configured"] is True
    assert current.json()["can_manage"] is True
    assert SECRET not in current.text


def test_legacy_settings_cannot_overwrite_connection_based_configuration(
    permission_client, ai_secret
):
    client, _ids = permission_client
    login(client)
    save_connections(client, [connection()])

    response = client.patch(
        "/api/v1/ai/settings",
        json={"base_url": "https://images.example.test/v1", "model": "m", "api_key": "k"},
    )

    assert response.status_code == 409
    assert response.json()["error_code"] == "AI_USE_CONNECTIONS"


# --- geração de imagens ----------------------------------------------------------


def image_setup(client):
    save_connections(client, [connection()], tool_connections={"image-generator": "principal"})


def test_image_generation_accepts_url_results(permission_client, ai_secret, monkeypatch):
    client, ids = permission_client
    login(client)
    image_setup(client)
    fake_provider(
        monkeypatch,
        FakeResponse({"data": [{"url": "https://cdn.example.test/a.png"}, {"revised": "x"}]}),
    )

    response = client.post("/api/v1/ai/generation/image", json={"prompt": "Farol"})

    assert response.status_code == 200
    assert response.json()["images"] == [{"url": "https://cdn.example.test/a.png"}]
    assert [event["status"] for event in usage_events(ids)] == ["ok"]


@pytest.mark.parametrize(
    ("outcome", "status", "code", "usage_code"),
    [
        (FakeResponse({"data": []}), 502, "AI_INVALID_RESPONSE", "AI_INVALID_RESPONSE"),
        (FakeResponse({}, status=401), 422, "AI_GENERATION_REJECTED", "PROVIDER_HTTP_ERROR"),
        (httpx.ReadTimeout("lento"), 503, "AI_PROVIDER_UNAVAILABLE", "PROVIDER_UNAVAILABLE"),
    ],
)
def test_image_generation_failures_are_recorded_without_leaking_key(
    permission_client, ai_secret, monkeypatch, outcome, status, code, usage_code
):
    client, ids = permission_client
    login(client)
    image_setup(client)
    fake_provider(monkeypatch, outcome)

    response = client.post("/api/v1/ai/generation/image", json={"prompt": "Farol"})

    assert response.status_code == status
    assert response.json()["error_code"] == code
    assert SECRET not in response.text
    events = usage_events(ids)
    assert [(event["status"], event["error_code"]) for event in events] == [("error", usage_code)]


# --- Video Studio ----------------------------------------------------------------


def test_video_studio_without_any_connection_is_not_configured(permission_client):
    client, _ids = permission_client
    login(client)

    response = client.post(
        "/api/v1/ai/generation/video-studio", json={"stage": "roteiro", "prompt": "Ideia"}
    )

    assert response.status_code == 503
    assert response.json()["error_code"] == "AI_PROVIDER_NOT_CONFIGURED"


@pytest.mark.parametrize(
    ("provider", "outcome", "status", "code", "usage_code"),
    [
        (
            "anthropic",
            FakeResponse({"stop_reason": "max_tokens", "content": []}),
            502,
            "AI_OUTPUT_TRUNCATED",
            "AI_OUTPUT_TRUNCATED",
        ),
        (
            "compatible",
            FakeResponse({"choices": [{"message": {"content": "   "}}]}),
            502,
            "AI_INVALID_RESPONSE",
            "AI_INVALID_RESPONSE",
        ),
        (
            "compatible",
            FakeResponse({}, status=429),
            422,
            "AI_GENERATION_REJECTED",
            "PROVIDER_HTTP_ERROR",
        ),
        (
            "compatible",
            httpx.ConnectError("sem rede"),
            503,
            "AI_PROVIDER_UNAVAILABLE",
            "PROVIDER_UNAVAILABLE",
        ),
    ],
)
def test_video_studio_failures_are_recorded_without_leaking_key(
    permission_client, ai_secret, monkeypatch, provider, outcome, status, code, usage_code
):
    client, ids = permission_client
    login(client)
    save_connections(client, [connection(provider)])
    fake_provider(monkeypatch, outcome)

    response = client.post(
        "/api/v1/ai/generation/video-studio", json={"stage": "shot_list", "prompt": "Ideia"}
    )

    assert response.status_code == status
    assert response.json()["error_code"] == code
    assert SECRET not in response.text
    events = usage_events(ids)
    assert [(event["feature"], event["error_code"]) for event in events] == [
        ("video-studio.shot_list", usage_code)
    ]


# --- Copiloto --------------------------------------------------------------------


def test_copilot_without_assistant_connection_is_not_simulated(permission_client):
    client, ids = permission_client
    login(client)

    response = client.post("/api/v1/ai/copilot/chat", json={"message": "Olá"})

    assert response.status_code == 503
    assert response.json()["error_code"] == "AI_PROVIDER_NOT_CONFIGURED"
    assert usage_events(ids) == []

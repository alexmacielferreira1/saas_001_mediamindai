# ruff: noqa: F811

from app.core.config import get_settings
from app.models.identity import TenantRecord
from cryptography.fernet import Fernet
from sqlalchemy import select
from test_permission_groups_api import login, permission_client  # noqa: F401


def test_connections_preserve_secrets_resolve_tools_and_deny_other_tenant(permission_client):
    client, ids = permission_client
    login(client)
    body = {
        "connections": [
            {
                "id": "images",
                "name": "Imagens",
                "base_url": "https://images.example.test/v1",
                "model": "image-pro",
                "api_key": "private-provider-key",
            }
        ],
        "default_connection_id": "images",
        "tool_connections": {},
    }
    saved = client.put("/api/v1/ai/connections", json=body)
    assert saved.status_code == 200
    assert "private-provider-key" not in saved.text
    assert client.get("/api/v1/ai/generation/image/status").json()["configured"]
    del body["connections"][0]["api_key"]
    body["tool_connections"] = {"image-generator": None}
    assert client.put("/api/v1/ai/connections", json=body).status_code == 200
    assert not client.get("/api/v1/ai/generation/image/status").json()["configured"]
    assert client.get(f"/api/v1/ai/connections?tenant_id={ids['other']}").status_code == 403
    login(client, "viewer@mediamind.ai")
    assert client.get("/api/v1/ai/connections").json()["can_manage"] is False
    assert client.put("/api/v1/ai/connections", json=body).status_code == 403


def test_superadmin_can_configure_all_companies_without_permission_group(permission_client):
    from app.models.identity import Membership

    client, ids = permission_client
    with ids["session_factory"]() as session:
        member = session.scalar(select(Membership).where(Membership.role == "admin"))
        member.role = "superadmin"
        member.permission_group_id = None
        session.commit()
    login(client)
    assert len(client.get("/api/v1/ai/companies").json()["companies"]) == 2
    assert (
        client.put(
            f"/api/v1/ai/connections?tenant_id={ids['other']}", json={"connections": []}
        ).status_code
        == 200
    )
    assert client.get(f"/api/v1/ai/connections?tenant_id={ids['other']}").json()["can_manage"]


def test_claude_connection_does_not_send_image_requests_or_reuse_openai_secret(permission_client):
    client, _ids = permission_client
    login(client)
    item = {
        "id": "main",
        "name": "Minha IA",
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-image-1",
        "api_key": "openai-test-key",
    }
    assert (
        client.put(
            "/api/v1/ai/connections", json={"connections": [item], "default_connection_id": "main"}
        ).status_code
        == 200
    )
    item.update(
        provider="anthropic", base_url="https://api.anthropic.com/v1", model="claude-sonnet-5-5"
    )
    del item["api_key"]
    assert (
        client.put(
            "/api/v1/ai/connections", json={"connections": [item], "default_connection_id": "main"}
        ).status_code
        == 422
    )
    item["api_key"] = "anthropic-test-key"
    result = client.put(
        "/api/v1/ai/connections", json={"connections": [item], "default_connection_id": "main"}
    )
    assert result.status_code == 200
    assert "anthropic-test-key" not in result.text
    assert not client.get("/api/v1/ai/generation/image/status").json()["configured"]
    response = client.post("/api/v1/ai/generation/image", json={"prompt": "Teste"})
    assert response.status_code == 422
    assert response.json()["error_code"] == "AI_CAPABILITY_UNSUPPORTED"


def test_demo_login_authenticates_only_seeded_accounts_locally(permission_client, monkeypatch):
    from test_permission_groups_api import PASSWORD

    client, _ids = permission_client
    monkeypatch.setenv("DEMO_PASSWORD", PASSWORD)
    monkeypatch.setenv("ENVIRONMENT", "local")
    get_settings.cache_clear()
    assert (
        client.post("/api/v1/auth/demo", json={"email": "unknown@example.test"}).status_code == 403
    )
    assert client.post("/api/v1/auth/demo", json={"email": "admin@mediamind.ai"}).status_code == 200
    assert client.get("/api/v1/ai/connections").status_code == 200
    monkeypatch.setenv("ENVIRONMENT", "staging")
    get_settings.cache_clear()
    assert client.post("/api/v1/auth/demo", json={"email": "admin@mediamind.ai"}).status_code == 404
    get_settings.cache_clear()


def test_ai_function_requires_authentication(permission_client):
    client, _ = permission_client

    response = client.post(
        "/api/v1/ai/functions/assistente_ia",
        json={"message": "Olá"},
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "AUTHENTICATION_REQUIRED"


def test_ai_function_reports_provider_not_configured(permission_client):
    client, _ = permission_client
    login(client, "admin@mediamind.ai")

    response = client.post(
        "/api/v1/ai/functions/assistente_ia",
        json={"message": "Olá"},
    )

    assert response.status_code == 503
    assert response.json()["error_code"] == "AI_PROVIDER_NOT_CONFIGURED"
    assert response.json()["retryable"] is False


def test_ai_function_rejects_unknown_legacy_function(permission_client):
    client, _ = permission_client
    login(client, "admin@mediamind.ai")

    response = client.post(
        "/api/v1/ai/functions/funcao_inexistente",
        json={},
    )

    assert response.status_code == 404
    assert response.json()["error_code"] == "AI_FUNCTION_NOT_FOUND"


def test_image_generation_status_reports_configured_provider_without_secret(
    permission_client,
    monkeypatch,
):
    client, ids = permission_client
    login(client, "admin@mediamind.ai")
    monkeypatch.setenv("AI_SECRET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    saved = client.patch(
        "/api/v1/ai/settings",
        json={
            "provider": "compatible",
            "base_url": "https://images.example.test/v1",
            "model": "image-pro",
            "api_key": "never-return-this",
        },
    )
    assert saved.status_code == 200
    assert saved.json()["key_configured"] is True
    assert "never-return-this" not in saved.text
    with ids["session_factory"]() as session:
        record = session.scalar(
            select(TenantRecord).where(TenantRecord.entity_type == "AISettings")
        )
        assert "never-return-this" not in str(record.data)

    response = client.get("/api/v1/ai/generation/image/status")

    assert response.status_code == 200
    assert response.json() == {
        "configured": True,
        "provider": "compatible",
        "model": "image-pro",
    }
    assert "never-return-this" not in response.text
    get_settings.cache_clear()


def test_image_generation_normalizes_provider_result(permission_client, monkeypatch):
    client, _ = permission_client
    login(client, "admin@mediamind.ai")
    monkeypatch.setenv("AI_SECRET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    assert (
        client.patch(
            "/api/v1/ai/settings",
            json={
                "provider": "compatible",
                "base_url": "https://images.example.test/v1",
                "model": "image-pro",
                "api_key": "provider-secret",
            },
        ).status_code
        == 200
    )

    assert (
        client.put(
            "/api/v1/ai/connections",
            json={
                "connections": [
                    {
                        "id": "legacy",
                        "name": "Imagens",
                        "base_url": "https://images.example.test/v1",
                        "model": "image-pro",
                    },
                    {
                        "id": "text",
                        "name": "Textos",
                        "base_url": "https://text.example.test/v1",
                        "model": "text-pro",
                        "api_key": "text-test-key",
                    },
                ],
                "default_connection_id": "text",
                "tool_connections": {"image-generator": "legacy"},
            },
        ).status_code
        == 200
    )

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"data": [{"b64_json": "aW1hZ2U="}]}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, *, headers, json):
            assert url == "https://images.example.test/v1/images/generations"
            assert headers == {"Authorization": "Bearer provider-secret"}
            assert json == {
                "model": "image-pro",
                "prompt": "Um farol sob chuva",
                "n": 1,
                "size": "1536x1024",
                "response_format": "b64_json",
            }
            return FakeResponse()

    monkeypatch.setattr("app.api.v1.ai.httpx.AsyncClient", lambda **_kwargs: FakeClient())

    response = client.post(
        "/api/v1/ai/generation/image",
        json={"prompt": "Um farol sob chuva", "aspect": "16:9", "count": 1},
    )

    assert response.status_code == 200
    assert response.json() == {
        "images": [{"url": "data:image/png;base64,aW1hZ2U="}],
        "model": "image-pro",
        "provider": "compatible",
    }
    get_settings.cache_clear()


def test_local_environment_creates_private_master_key_for_ai_settings(
    permission_client,
    monkeypatch,
    tmp_path,
):
    client, _ = permission_client
    login(client, "admin@mediamind.ai")
    monkeypatch.delenv("AI_SECRET_KEY", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path / "media"))
    get_settings.cache_clear()

    response = client.patch(
        "/api/v1/ai/settings",
        json={
            "provider": "compatible",
            "base_url": "https://images.example.test/v1",
            "model": "image-pro",
            "api_key": "local-private-key",
        },
    )

    assert response.status_code == 200
    key_file = tmp_path / "ai-secret.key"
    assert key_file.is_file()
    assert "local-private-key" not in key_file.read_text(encoding="utf-8")
    get_settings.cache_clear()

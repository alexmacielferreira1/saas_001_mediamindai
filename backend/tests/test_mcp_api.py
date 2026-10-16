# Imported pytest fixture is intentionally injected by the test parameter.
# ruff: noqa: F811
from app.core.config import get_settings
from app.models.identity import TenantRecord
from cryptography.fernet import Fernet
from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def test_mcp_catalog_requires_authentication(permission_client):
    client, _ = permission_client

    response = client.get("/api/v1/mcp/tools")

    assert response.status_code == 401


def test_mcp_catalog_exposes_connected_modules_and_available_tools(permission_client):
    client, _ = permission_client
    login(client)

    response = client.get("/api/v1/mcp/tools")

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "read_and_generate"
    assert [module["id"] for module in payload["modules"]] == [
        "system",
        "mmfilm",
        "mmeffects",
        "vetor",
        "mmphoto",
        "mmsom",
        "word",
        "excel",
        "powerpoint",
        "ai-tools",
    ]
    capabilities = next(tool for tool in payload["tools"] if tool["name"] == "system.capabilities")
    assert capabilities["available"] is True
    assert capabilities["effect"] == "read"
    statuses = {module["id"]: module["status"] for module in payload["modules"]}
    assert statuses["system"] == "connected"
    assert statuses["mmfilm"] == "connected"
    assert statuses["mmphoto"] == "planned"
    assert statuses["word"] == "planned"
    assert statuses["ai-tools"] == "connected"
    assert sum(tool["available"] for tool in payload["tools"]) == 5
    assert any(tool["effect"] == "write" and not tool["available"] for tool in payload["tools"])


def test_mcp_executes_capability_discovery_with_server_context(permission_client):
    client, ids = permission_client
    login(client)

    response = client.post(
        "/api/v1/mcp/tools/system.capabilities/call",
        json={"arguments": {"tenant_id": "forged", "include_planned": True}},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["tool"] == "system.capabilities"
    assert payload["status"] == "completed"
    assert payload["tenant_id"] == str(ids["tenant"])
    assert payload["result"]["connected_modules"] == ["system", "mmfilm", "ai-tools"]
    assert payload["correlation_id"]
    assert payload["duration_ms"] >= 0


def test_mcp_rejects_unknown_and_unavailable_tools(permission_client):
    client, _ = permission_client
    login(client)

    unknown = client.post("/api/v1/mcp/tools/system.delete_all/call", json={"arguments": {}})
    unavailable = client.post(
        "/api/v1/mcp/tools/mmphoto.planned.aplicar_ajuste/call", json={"arguments": {}}
    )

    assert unknown.status_code == 404
    assert unknown.json()["error_code"] == "MCP_TOOL_NOT_FOUND"
    assert unavailable.status_code == 409
    assert unavailable.json()["error_code"] == "MCP_TOOL_UNAVAILABLE"


def test_mcp_never_executes_write_tools_even_if_catalog_marks_them_available(
    permission_client, monkeypatch
):
    from app.api.v1 import mcp as mcp_api

    client, _ = permission_client
    login(client)
    tool = next(item for item in mcp_api.TOOLS if item["name"] == "mmfilm.planned.montar_sequência")
    monkeypatch.setitem(tool, "available", True)

    response = client.post(
        "/api/v1/mcp/tools/mmfilm.planned.montar_sequência/call",
        json={"arguments": {"project_id": "EP01"}},
    )

    assert response.status_code == 409
    assert response.json()["error_code"] == "MCP_TOOL_UNAVAILABLE"


def test_mcp_runs_read_only_variants_for_every_media_tool(permission_client):
    client, _ = permission_client
    login(client)

    response = client.post(
        "/api/v1/mcp/tools/mmphoto.inspect/call",
        json={"arguments": {"project_id": "project-1"}},
    )
    assert response.status_code == 409
    assert response.json()["error_code"] == "MCP_TOOL_UNAVAILABLE"


def test_mcp_inspects_real_tenant_assets_and_does_not_leak_other_tenant(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        own = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="Asset",
            data={
                "filename": "entrevista.mp4",
                "title": "Entrevista",
                "asset_type": "video",
                "duration": 42.5,
                "storage_key": "private/original.mp4",
            },
        )
        foreign = TenantRecord(
            tenant_id=ids["other"],
            entity_type="Asset",
            data={"filename": "segredo.mp4", "asset_type": "video"},
        )
        session.add_all([own, foreign])
        session.commit()
        own_id = str(own.id)
    login(client)

    response = client.post(
        "/api/v1/mcp/tools/mmfilm.inspect/call",
        json={"arguments": {"asset_ids": [own_id], "project_id": "EP01"}},
    )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["project_id"] == "EP01"
    assert result["asset_count"] == 1
    assert result["assets"][0]["filename"] == "entrevista.mp4"
    assert result["assets"][0]["duration"] == 42.5
    assert "storage_key" not in result["assets"][0]
    assert "segredo.mp4" not in response.text


def test_mcp_immediate_request_executes_real_asset_inspection(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        asset = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="Asset",
            data={"filename": "lote.mp4", "asset_type": "video", "duration": 12},
        )
        session.add(asset)
        session.commit()
        asset_id = str(asset.id)
    login(client)

    response = client.post(
        "/api/v1/mcp/queues",
        json={
            "name": "Inspeção imediata",
            "module": "mmfilm",
            "tool_name": "mmfilm.inspect",
            "instruction": "Inspecionar mídia selecionada.",
            "target_projects": ["EP01"],
            "output_mode": "internal",
            "execution_mode": "immediate",
            "targets": [{"id": "EP01", "name": "EP01", "asset_ids": [asset_id]}],
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "completed"
    assert response.json()["results"][0]["status"] == "completed"
    assert response.json()["results"][0]["asset_count"] == 1


def test_mcp_batch_executes_each_target_and_persists_results(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        first = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="Asset",
            data={"filename": "a.mp4", "asset_type": "video"},
        )
        second = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="Asset",
            data={"filename": "b.mp4", "asset_type": "video"},
        )
        session.add_all([first, second])
        session.commit()
        first_id, second_id = str(first.id), str(second.id)
    login(client)
    created = client.post(
        "/api/v1/mcp/queues",
        json={
            "name": "Inspeção em lote",
            "module": "mmfilm",
            "tool_name": "mmfilm.inspect",
            "instruction": "Inspecionar lote.",
            "target_projects": ["EP01", "EP02"],
            "output_mode": "internal",
            "execution_mode": "queue",
            "targets": [
                {"id": "EP01", "name": "EP01", "asset_ids": [first_id]},
                {"id": "EP02", "name": "EP02", "asset_ids": [second_id]},
            ],
        },
    )

    executed = client.post(f"/api/v1/mcp/queues/{created.json()['id']}/execute")

    assert executed.status_code == 200
    assert executed.json()["status"] == "completed"
    assert [item["asset_count"] for item in executed.json()["results"]] == [1, 1]
    queues = client.get("/api/v1/mcp/queues").json()["queues"]
    persisted = next(item for item in queues if item["id"] == created.json()["id"])
    assert persisted["status"] == "completed"
    assert len(persisted["results"]) == 2


def test_mcp_prompt_uses_registered_company_ai_connection(permission_client, monkeypatch):
    client, _ids = permission_client
    login(client)
    monkeypatch.setenv("AI_SECRET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    saved = client.put(
        "/api/v1/ai/connections",
        json={
            "connections": [
                {
                    "id": "assistant-provider",
                    "name": "Assistente cadastrado",
                    "provider": "compatible",
                    "base_url": "https://provider.example.test/v1",
                    "model": "model-with-credits",
                    "api_key": "private-provider-key",
                }
            ],
            "default_connection_id": "assistant-provider",
            "tool_connections": {"assistant": "assistant-provider"},
        },
    )
    assert saved.status_code == 200

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [{"finish_reason": "stop", "message": {"content": "Resposta MCP real"}}]
            }

    calls = []

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, *, headers, json):
            calls.append((url, headers, json))
            return FakeResponse()

    monkeypatch.setattr("app.api.v1.ai.httpx.AsyncClient", lambda **_kwargs: FakeClient())
    response = client.post(
        "/api/v1/mcp/tools/ai-tools.prompt/call",
        json={"arguments": {"prompt": "Analise o projeto sem inventar dados."}},
    )

    assert response.status_code == 200
    assert response.json()["result"] == {
        "operation": "ai-tools.prompt",
        "mode": "provider",
        "text": "Resposta MCP real",
        "provider": "compatible",
        "model": "model-with-credits",
        "connection_id": "assistant-provider",
    }
    assert calls[0][0] == "https://provider.example.test/v1/chat/completions"
    assert calls[0][1]["authorization"] == "Bearer private-provider-key"
    assert calls[0][2]["messages"] == [
        {"role": "user", "content": "Analise o projeto sem inventar dados."}
    ]
    assert "private-provider-key" not in response.text
    get_settings.cache_clear()


def test_mcp_video_studio_prompt_uses_its_assigned_connection(permission_client, monkeypatch):
    client, _ids = permission_client
    login(client)
    monkeypatch.setenv("AI_SECRET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    saved = client.put(
        "/api/v1/ai/connections",
        json={
            "connections": [
                {
                    "id": "video-provider",
                    "name": "Video Studio cadastrado",
                    "provider": "compatible",
                    "base_url": "https://video-provider.example.test/v1",
                    "model": "video-planning-model",
                    "api_key": "private-video-key",
                }
            ],
            "default_connection_id": "video-provider",
            "tool_connections": {"video-studio": "video-provider"},
        },
    )
    assert saved.status_code == 200

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {"finish_reason": "stop", "message": {"content": "Roteiro do vídeo"}}
                ]
            }

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, _url, *, headers, json):
            assert headers["authorization"] == "Bearer private-video-key"
            assert json["model"] == "video-planning-model"
            return FakeResponse()

    monkeypatch.setattr("app.api.v1.ai.httpx.AsyncClient", lambda **_kwargs: FakeClient())
    response = client.post(
        "/api/v1/mcp/tools/ai-tools.video_studio/call",
        json={"arguments": {"prompt": "Crie uma decupagem em seis cenas."}},
    )

    assert response.status_code == 200
    assert response.json()["result"] == {
        "operation": "ai-tools.video_studio",
        "mode": "provider",
        "text": "Roteiro do vídeo",
        "provider": "compatible",
        "model": "video-planning-model",
        "connection_id": "video-provider",
    }
    get_settings.cache_clear()


def test_mcp_persists_immediate_requests_and_batch_queue_separately(permission_client):
    client, _ = permission_client
    login(client)
    immediate = client.post(
        "/api/v1/mcp/queues",
        json={
            "name": "Ajustar corte",
            "module": "mmfilm",
            "instruction": "Ajustar cortes.",
            "target_projects": ["EP01"],
            "create_projects": [],
            "output_mode": "internal",
            "execution_mode": "immediate",
        },
    )
    batch = client.post(
        "/api/v1/mcp/queues",
        json={
            "name": "Pacote social",
            "module": "mmfilm",
            "instruction": "Criar versões sociais.",
            "target_projects": ["EP01", "EP02"],
            "create_projects": ["EP03"],
            "output_mode": "external",
            "execution_mode": "queue",
        },
    )
    assert immediate.status_code == 201 and immediate.json()["status"] == "completed"
    assert batch.status_code == 201 and batch.json()["status"] == "draft"
    queues = client.get("/api/v1/mcp/queues")
    assert queues.status_code == 200
    assert len(queues.json()["queues"]) == 2
    execute = client.post(f"/api/v1/mcp/queues/{batch.json()['id']}/execute")
    assert execute.status_code == 200
    assert execute.json()["status"] == "completed"


def test_mcp_queue_validates_role_module_and_queue_id(permission_client):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")
    forbidden = client.post(
        "/api/v1/mcp/queues",
        json={
            "name": "Sem permissão",
            "module": "mmfilm",
            "instruction": "Não deve salvar.",
            "output_mode": "internal",
            "execution_mode": "queue",
        },
    )
    assert forbidden.status_code == 403

    login(client)
    invalid_module = client.post(
        "/api/v1/mcp/queues",
        json={
            "name": "Módulo inválido",
            "module": "desconhecido",
            "instruction": "Não deve salvar.",
            "output_mode": "internal",
            "execution_mode": "queue",
        },
    )
    assert invalid_module.status_code == 404
    missing = client.post("/api/v1/mcp/queues/00000000-0000-0000-0000-000000000001/execute")
    assert missing.status_code == 404

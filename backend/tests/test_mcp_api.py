# Imported pytest fixture is intentionally injected by the test parameter.
# ruff: noqa: F811
from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def test_mcp_catalog_requires_authentication(permission_client):
    client, _ = permission_client

    response = client.get("/api/v1/mcp/tools")

    assert response.status_code == 401


def test_mcp_catalog_exposes_transversal_modules_and_read_only_tools(permission_client):
    client, _ = permission_client
    login(client)

    response = client.get("/api/v1/mcp/tools")

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "read_only"
    assert [module["id"] for module in payload["modules"]] == [
        "system",
        "mmfilm",
        "mmeffects",
        "vetor",
        "mmphoto",
        "mmsom",
        "office",
        "ai-tools",
    ]
    capabilities = next(tool for tool in payload["tools"] if tool["name"] == "system.capabilities")
    assert capabilities["available"] is True
    assert capabilities["effect"] == "read"
    assert all(module["status"] == "connected" for module in payload["modules"])
    assert sum(tool["available"] for tool in payload["tools"]) > 15
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
    assert payload["result"]["connected_modules"] == [
        "system",
        "mmfilm",
        "mmeffects",
        "vetor",
        "mmphoto",
        "mmsom",
        "office",
        "ai-tools",
    ]
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

    for name in [
        "mmfilm.timeline",
        "mmeffects.render_queue",
        "vetor.artboards",
        "mmphoto.layers",
        "mmsom.loudness",
        "office.outline",
        "ai-tools.providers",
    ]:
        response = client.post(
            f"/api/v1/mcp/tools/{name}/call", json={"arguments": {"project_id": "project-1"}}
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["result"]["operation"] == name
        assert payload["result"]["mode"] == "read_only"


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
    assert immediate.status_code == 201 and immediate.json()["status"] == "requested"
    assert batch.status_code == 201 and batch.json()["status"] == "draft"
    queues = client.get("/api/v1/mcp/queues")
    assert queues.status_code == 200
    assert len(queues.json()["queues"]) == 2
    execute = client.post(f"/api/v1/mcp/queues/{batch.json()['id']}/execute")
    assert execute.status_code == 409
    assert execute.json()["error_code"] == "MCP_EXECUTION_BRIDGE_UNAVAILABLE"


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

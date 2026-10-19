# ruff: noqa: F811
from app.models.identity import TenantRecord
from test_permission_groups_api import login, permission_client  # noqa: F401


def test_viewer_cannot_execute_an_existing_queue(permission_client):
    client, _ = permission_client
    login(client)
    created = client.post(
        "/api/v1/mcp/queues",
        json={
            "name": "Fila protegida",
            "module": "mmfilm",
            "tool_name": "mmfilm.inspect",
            "instruction": "Inspecionar mídia.",
            "output_mode": "internal",
            "execution_mode": "queue",
        },
    )
    assert created.status_code == 201
    queue_id = created.json()["id"]

    login(client, "viewer@mediamind.ai")
    response = client.post(f"/api/v1/mcp/queues/{queue_id}/execute")
    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"

    queues = client.get("/api/v1/mcp/queues").json()["queues"]
    assert next(queue for queue in queues if queue["id"] == queue_id)["status"] == "draft"


def test_invalid_selected_asset_does_not_expand_inspection_to_all_assets(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        session.add(
            TenantRecord(
                tenant_id=ids["tenant"],
                entity_type="Asset",
                data={"filename": "unselected.mp4", "asset_type": "video"},
            )
        )
        session.commit()
    login(client)

    response = client.post(
        "/api/v1/mcp/tools/mmfilm.inspect/call",
        json={"arguments": {"asset_ids": ["not-a-valid-id"]}},
    )
    assert response.status_code == 422
    assert response.json()["error_code"] == "MCP_INVALID_ASSET_ID"
    assert "unselected.mp4" not in response.text


def test_viewer_can_inspect_but_cannot_generate_using_direct_mcp_call(
    permission_client, monkeypatch
):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")
    inspect = client.post("/api/v1/mcp/tools/system.capabilities/call", json={"arguments": {}})
    assert inspect.status_code == 200

    called = []

    async def fake_run_tool(*args, **kwargs):
        called.append((args, kwargs))
        return {"text": "generated"}

    monkeypatch.setattr("app.api.v1.mcp.run_tool", fake_run_tool)
    response = client.post(
        "/api/v1/mcp/tools/ai-tools.prompt/call", json={"arguments": {"prompt": "test"}}
    )
    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"
    assert called == []

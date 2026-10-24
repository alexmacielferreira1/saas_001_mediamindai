# ruff: noqa: F811
import asyncio
from uuid import uuid4

import pytest
from app.api.v1.mcp import run_tool
from app.core.errors import PublicError
from app.models.identity import TenantRecord
from test_mcp_api import login
from test_permission_groups_api import permission_client  # noqa: F401


def test_mcp_ai_tool_requires_a_prompt(permission_client):
    client, _ = permission_client
    login(client)

    response = client.post(
        "/api/v1/mcp/tools/ai-tools.prompt/call", json={"arguments": {"prompt": "   "}}
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "MCP_PROMPT_REQUIRED"


def test_mcp_ai_tool_without_company_connection_is_not_simulated(permission_client):
    client, _ = permission_client
    login(client)

    response = client.post(
        "/api/v1/mcp/tools/ai-tools.prompt/call", json={"arguments": {"prompt": "Resuma."}}
    )

    assert response.status_code == 503
    assert response.json()["error_code"] == "AI_PROVIDER_NOT_CONFIGURED"


def test_mcp_ai_tool_ignores_connection_of_other_tenant(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        session.add(
            TenantRecord(
                tenant_id=ids["other"],
                entity_type="AISettings",
                data={
                    "connections": [
                        {
                            "id": "alheia",
                            "provider": "compatible",
                            "base_url": "https://provider.example.test/v1",
                            "model": "m",
                            "enabled": True,
                            "encrypted_key": "x",
                        }
                    ],
                    "default_connection_id": "alheia",
                },
            )
        )
        session.commit()
    login(client)

    response = client.post(
        "/api/v1/mcp/tools/ai-tools.prompt/call", json={"arguments": {"prompt": "Resuma."}}
    )

    assert response.status_code == 503
    assert response.json()["error_code"] == "AI_PROVIDER_NOT_CONFIGURED"


def test_mcp_queue_without_targets_inspects_company_library_once(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        session.add_all(
            [
                TenantRecord(
                    tenant_id=ids["tenant"],
                    entity_type="Asset",
                    data={"filename": "a.mp4", "asset_type": "video"},
                ),
                TenantRecord(
                    tenant_id=ids["other"],
                    entity_type="Asset",
                    data={"filename": "alheio.mp4", "asset_type": "video"},
                ),
            ]
        )
        session.commit()
    login(client)

    created = client.post(
        "/api/v1/mcp/queues",
        json={
            "name": "Acervo inteiro",
            "module": "mmfilm",
            "tool_name": "mmfilm.inspect",
            "instruction": "Inspecionar o acervo.",
            "output_mode": "internal",
            "execution_mode": "immediate",
        },
    )

    assert created.status_code == 201
    payload = created.json()
    assert payload["status"] == "completed"
    assert [item["target_name"] for item in payload["results"]] == ["Acervo da empresa"]
    assert payload["results"][0]["target_id"] is None
    assert "alheio.mp4" not in created.text

    again = client.post(f"/api/v1/mcp/queues/{payload['id']}/execute")

    assert again.status_code == 200
    assert again.json()["results"] == payload["results"]
    assert again.json()["status"] == "completed"


def test_mcp_queue_of_other_tenant_cannot_be_executed(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        foreign = TenantRecord(
            tenant_id=ids["other"],
            entity_type="MCPQueue",
            data={"module": "mmfilm", "tool_name": "mmfilm.inspect", "status": "draft"},
        )
        session.add(foreign)
        session.commit()
        foreign_id = foreign.id
    login(client)

    response = client.post(f"/api/v1/mcp/queues/{foreign_id}/execute")

    assert response.status_code == 404
    assert response.json()["error_code"] == "MCP_QUEUE_NOT_FOUND"


def test_run_tool_rejects_tool_removed_from_catalog(permission_client):
    _client, ids = permission_client
    with ids["session_factory"]() as session, pytest.raises(PublicError) as error:
        asyncio.run(run_tool(session, ids["tenant"], "mmfilm.removida", {}, uuid4()))

    assert error.value.code == "MCP_TOOL_NOT_FOUND"


def test_inspection_result_describes_read_only_adapter_and_write_gate():
    # Helper público do registro (hoje sem chamador na API): o contrato read-only é fixo.
    from app.mcp.registry import READ_OPERATIONS, WRITE_OPERATIONS, inspection_result, tool_by_name

    tool = tool_by_name("mmfilm.inspect")
    result = inspection_result(tool, {"project_id": "EP01", "asset_id": "a1"})

    assert result["adapter"] == "mediamind-mmfilm-read-only"
    assert result["mode"] == "read_only"
    assert result["project_id"] == "EP01"
    assert result["capabilities"] == [item[0] for item in READ_OPERATIONS["mmfilm"]]
    assert result["write_actions"] == WRITE_OPERATIONS["mmfilm"]

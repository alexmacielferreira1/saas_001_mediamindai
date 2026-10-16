from time import perf_counter
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.ai import ai_settings_record, generate_connection_text, resolve_connection
from app.api.v1.records import add_audit
from app.core.errors import PublicError
from app.db.session import get_session
from app.mcp.registry import MODULES, TOOLS, capability_result, tool_by_name
from app.models.identity import TenantRecord
from app.schemas.mcp import MCPQueueCreate, MCPToolCall
from app.tenancy.context import CurrentSession, get_current_session, require_membership

router = APIRouter(prefix="/mcp", tags=["mcp"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
QUEUE_ENTITY = "MCPQueue"
AI_CONNECTION_BY_TOOL = {
    "ai-tools.prompt": "assistant",
    "ai-tools.video_studio": "video-studio",
}


def inspect_assets(session: Session, tenant_id: UUID, arguments: dict, *, operation: str) -> dict:
    asset_ids = []
    for value in arguments.get("asset_ids") or []:
        try:
            asset_ids.append(UUID(str(value)))
        except (TypeError, ValueError):
            continue
    query = select(TenantRecord).where(
        TenantRecord.tenant_id == tenant_id,
        TenantRecord.entity_type == "Asset",
    )
    if asset_ids:
        query = query.where(TenantRecord.id.in_(asset_ids))
    rows = list(session.scalars(query.order_by(TenantRecord.created_at.desc())))
    assets = [
        {
            "id": str(row.id),
            **{key: value for key, value in row.data.items() if key != "storage_key"},
        }
        for row in rows
    ]
    return {
        "operation": operation,
        "mode": "read_only",
        "project_id": arguments.get("project_id"),
        "asset_count": len(assets),
        "assets": assets,
    }


async def run_tool(session: Session, tenant_id: UUID, tool_name: str, arguments: dict) -> dict:
    tool = tool_by_name(tool_name)
    if tool is None:
        raise PublicError(404, "MCP_TOOL_NOT_FOUND", "Ferramenta MCP não encontrada.")
    if not tool["available"]:
        raise PublicError(409, "MCP_TOOL_UNAVAILABLE", "Ferramenta MCP ainda não está conectada.")
    if tool_name == "system.capabilities":
        return capability_result()
    if tool_name in {"mmfilm.inspect", "mmfilm.timeline"}:
        return inspect_assets(session, tenant_id, arguments, operation=tool_name)
    if tool_name in AI_CONNECTION_BY_TOOL:
        prompt = str(arguments.get("prompt") or "").strip()
        if not prompt:
            raise PublicError(
                422, "MCP_PROMPT_REQUIRED", "Informe o prompt para a ferramenta de IA."
            )
        record = ai_settings_record(session, tenant_id)
        connection = resolve_connection(
            record.data if record else {}, AI_CONNECTION_BY_TOOL[tool_name]
        )
        if not connection:
            raise PublicError(
                503,
                "AI_PROVIDER_NOT_CONFIGURED",
                "Cadastre uma conexão de IA ativa para esta ferramenta.",
            )
        text = await generate_connection_text(connection, prompt)
        return {
            "operation": tool_name,
            "mode": "provider",
            "text": text,
            "provider": connection["provider"],
            "model": connection["model"],
            "connection_id": connection["id"],
        }
    raise PublicError(409, "MCP_TOOL_UNAVAILABLE", "Ferramenta MCP ainda não está conectada.")


async def execute_queue_record(record: TenantRecord, session: Session) -> None:
    tool_name = record.data.get("tool_name") or f"{record.data['module']}.inspect"
    targets = record.data.get("targets") or [
        {"id": value, "name": value, "asset_ids": []}
        for value in record.data.get("target_projects", [])
    ]
    if not targets:
        targets = [{"id": None, "name": "Acervo da empresa", "asset_ids": []}]
    results = []
    for target in targets:
        result = await run_tool(
            session,
            record.tenant_id,
            tool_name,
            {
                "project_id": target.get("id") or target.get("name"),
                "asset_ids": target.get("asset_ids") or [],
                "prompt": target.get("instruction") or record.data.get("instruction"),
            },
        )
        results.append({"target_id": target.get("id"), "status": "completed", **result})
    record.data = {**record.data, "status": "completed", "results": results}


@router.get("/tools")
def list_mcp_tools(current: Authenticated):
    require_membership(current)
    return {"mode": "read_and_generate", "modules": MODULES, "tools": TOOLS}


@router.post("/tools/{tool_name}/call")
async def call_mcp_tool(
    tool_name: str,
    body: MCPToolCall,
    request: Request,
    current: Authenticated,
    session: DbSession,
):
    started = perf_counter()
    membership = require_membership(current)
    tool = tool_by_name(tool_name)
    if tool is None:
        raise PublicError(404, "MCP_TOOL_NOT_FOUND", "Ferramenta MCP não encontrada.")
    result = await run_tool(session, membership.tenant_id, tool_name, body.arguments)
    correlation_id = getattr(request.state, "correlation_id", str(uuid4()))
    add_audit(
        session,
        current,
        "mcp.tool.called",
        "MCPTool",
        tool_name,
        {"tool": tool_name, "effect": tool["effect"], "correlation_id": correlation_id},
    )
    session.commit()
    return {
        "tool": tool_name,
        "status": "completed",
        "tenant_id": str(membership.tenant_id),
        "correlation_id": correlation_id,
        "duration_ms": round((perf_counter() - started) * 1000, 2),
        "result": result,
    }


def serialize_queue(record: TenantRecord) -> dict:
    return {
        "id": str(record.id),
        **record.data,
        "created_date": record.created_at.isoformat(),
        "updated_date": record.updated_at.isoformat(),
    }


@router.get("/queues")
def list_mcp_queues(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    rows = list(
        session.scalars(
            select(TenantRecord)
            .where(
                TenantRecord.tenant_id == membership.tenant_id,
                TenantRecord.entity_type == QUEUE_ENTITY,
            )
            .order_by(TenantRecord.updated_at.desc())
        )
    )
    return {"queues": [serialize_queue(row) for row in rows]}


@router.post("/queues", status_code=201)
async def create_mcp_queue(body: MCPQueueCreate, current: Authenticated, session: DbSession):
    membership = require_membership(current)
    if membership.role == "viewer":
        raise PublicError(403, "PERMISSION_DENIED", "Seu perfil permite somente leitura.")
    if body.module not in {module["id"] for module in MODULES}:
        raise PublicError(404, "MCP_MODULE_NOT_FOUND", "Aplicativo MCP não encontrado.")
    record = TenantRecord(
        tenant_id=membership.tenant_id,
        entity_type=QUEUE_ENTITY,
        data={
            **body.model_dump(),
            "status": "draft" if body.execution_mode == "queue" else "running",
            "execution_backend": "mediamind_native",
        },
    )
    session.add(record)
    session.flush()
    if body.execution_mode == "immediate":
        await execute_queue_record(record, session)
    add_audit(
        session,
        current,
        "mcp.queue.created",
        QUEUE_ENTITY,
        str(record.id),
        {"module": body.module, "mode": body.execution_mode},
    )
    session.commit()
    return serialize_queue(record)


@router.post("/queues/{queue_id}/execute")
async def execute_mcp_queue(queue_id: UUID, current: Authenticated, session: DbSession):
    membership = require_membership(current)
    record = session.scalar(
        select(TenantRecord).where(
            TenantRecord.id == queue_id,
            TenantRecord.tenant_id == membership.tenant_id,
            TenantRecord.entity_type == QUEUE_ENTITY,
        )
    )
    if record is None:
        raise PublicError(404, "MCP_QUEUE_NOT_FOUND", "Fila MCP não encontrada.")
    if record.data.get("status") == "completed":
        return serialize_queue(record)
    await execute_queue_record(record, session)
    add_audit(
        session,
        current,
        "mcp.queue.executed",
        QUEUE_ENTITY,
        str(record.id),
        {"module": record.data.get("module"), "tool": record.data.get("tool_name")},
    )
    session.commit()
    return serialize_queue(record)

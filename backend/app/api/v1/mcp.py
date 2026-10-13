from time import perf_counter
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.records import add_audit
from app.core.errors import PublicError
from app.db.session import get_session
from app.mcp.registry import MODULES, TOOLS, capability_result, inspection_result, tool_by_name
from app.models.identity import TenantRecord
from app.schemas.mcp import MCPQueueCreate, MCPToolCall
from app.tenancy.context import CurrentSession, get_current_session, require_membership

router = APIRouter(prefix="/mcp", tags=["mcp"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
QUEUE_ENTITY = "MCPQueue"


@router.get("/tools")
def list_mcp_tools(current: Authenticated):
    require_membership(current)
    return {"mode": "read_only", "modules": MODULES, "tools": TOOLS}


@router.post("/tools/{tool_name}/call")
def call_mcp_tool(
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
    if not tool["available"]:
        raise PublicError(409, "MCP_TOOL_UNAVAILABLE", "Ferramenta MCP ainda não está conectada.")
    if tool_name == "system.capabilities":
        result = capability_result()
    elif tool["effect"] == "read":
        result = inspection_result(tool, body.arguments)
    else:
        raise PublicError(409, "MCP_TOOL_UNAVAILABLE", "Ferramenta MCP ainda não está conectada.")
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
def create_mcp_queue(body: MCPQueueCreate, current: Authenticated, session: DbSession):
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
            "status": "draft" if body.execution_mode == "queue" else "requested",
            "execution_backend": "pending_local_bridge",
        },
    )
    session.add(record)
    session.flush()
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
def execute_mcp_queue(queue_id: UUID, current: Authenticated, session: DbSession):
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
    raise PublicError(
        409,
        "MCP_EXECUTION_BRIDGE_UNAVAILABLE",
        "A fila foi salva, mas a ponte local de execução ainda não está instalada.",
    )

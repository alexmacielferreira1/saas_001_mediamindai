from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import TenantRecord
from app.tenancy.context import CurrentSession, get_current_session, require_membership

router = APIRouter(prefix="/management", tags=["management"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]


def _status(data: dict[str, Any]) -> str:
    return str(data.get("status") or data.get("situacao") or "").strip().lower()


@router.get("/overview")
def management_overview(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    if membership.role not in {"admin", "superadmin"}:
        raise PublicError(403, "PERMISSION_DENIED", "Seu perfil não acessa a visão gerencial.")

    rows = list(session.scalars(select(TenantRecord).where(
        TenantRecord.tenant_id == membership.tenant_id,
    )))
    publications = [row for row in rows if row.entity_type == "Publicacao"]
    assets = [row for row in rows if row.entity_type == "Asset"]
    published = sum(_status(row.data) in {"publicado", "published"} for row in publications)
    scheduled = sum(_status(row.data) in {"agendado", "scheduled"} for row in publications)
    pending = len(publications) - published - scheduled
    decided = published + pending
    approval_rate = round(published * 100 / decided) if decided else 0

    calendar = sorted(
        (
            {
                "id": str(row.id),
                "title": row.data.get("titulo") or row.data.get("title") or "Publicação",
                "date": row.data.get("data_agendada") or row.data.get("scheduled_at") or "",
                "platform": row.data.get("plataforma") or row.data.get("platform") or "",
                "status": row.data.get("status") or row.data.get("situacao") or "Pendente",
            }
            for row in publications
        ),
        key=lambda item: item["date"],
    )[:8]
    indexed = sum(_status(row.data) in {"indexado", "indexed", "concluido", "completed"} for row in assets)
    failures = sum(_status(row.data) in {"falha", "failed", "erro", "error"} for row in assets)
    storage_bytes = sum(int(row.data.get("file_size") or row.data.get("size") or 0) for row in assets)

    return {
        "publications": {
            "published": published,
            "scheduled": scheduled,
            "pending": pending,
            "approval_rate": approval_rate,
            "calendar": calendar,
        },
        "social_metrics": [],
        "assets": {
            "total": len(assets),
            "indexed": indexed,
            "failures": failures,
            "storage_bytes": storage_bytes,
        },
        "processing": {
            "total": sum(row.entity_type == "ProcessamentoJob" for row in rows),
        },
        "audit_events": sum(row.entity_type == "LogAuditoria" for row in rows),
    }

from time import perf_counter
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import TenantRecord
from app.tenancy.access_policy import SCREEN_ROUTES, require_screen
from app.tenancy.context import CurrentSession, get_current_session, require_membership

router = APIRouter(prefix="/management", tags=["management"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
OVERVIEW_ENTITIES = ("Publicacao", "Asset", "ProcessamentoJob")


def _text(value: Any) -> str:
    """Campo livre exibido como texto; números viram texto e o resto fica vazio."""
    if isinstance(value, str):
        return value
    if isinstance(value, int | float) and not isinstance(value, bool):
        return str(value)
    return ""


def _size(value: Any) -> int:
    """Tamanho em bytes de um campo livre; valores inválidos contam como zero."""
    if isinstance(value, bool):
        return 0
    if isinstance(value, int | float):
        return max(0, int(value))
    if isinstance(value, str):
        try:
            return max(0, int(float(value)))
        except ValueError:
            return 0
    return 0


def _status(data: dict[str, Any]) -> str:
    return str(data.get("status") or data.get("situacao") or "").strip().lower()


def _database_service(session: Session) -> dict[str, Any]:
    """Measure the database with a trivial query; never expose driver errors."""
    start = perf_counter()
    try:
        healthy = session.execute(text("SELECT 1")).scalar() == 1
    except SQLAlchemyError:
        session.rollback()
        healthy = False
    latency_ms = round((perf_counter() - start) * 1000, 2)
    if not healthy:
        return {
            "key": "database",
            "label": "Banco de dados",
            "status": "error",
            "detail": "Sem resposta do banco de dados",
            "latency_ms": None,
        }
    return {
        "key": "database",
        "label": "Banco de dados",
        "status": "ok",
        "detail": f"Respondeu em {latency_ms} ms",
        "latency_ms": latency_ms,
    }


@router.get("/overview")
def management_overview(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    if membership.role not in {
        "admin",
        "superadmin",
        "cedoc",
        "editor",
        "producer",
        "reporter",
        "journalist",
    }:
        raise PublicError(
            403, "PERMISSION_DENIED", "Seu perfil não acessa os indicadores do acervo."
        )
    # Tela "gestao" retirada explicitamente do membro também bloqueia a rota (MM-003).
    require_screen(current, SCREEN_ROUTES["management.overview"])

    # Só as entidades exibidas em detalhe são carregadas; a trilha de auditoria (uma linha
    # por mutação) é apenas contada no SQL (auditoria 2026-10-23, #8).
    rows = list(
        session.scalars(
            select(TenantRecord).where(
                TenantRecord.tenant_id == membership.tenant_id,
                TenantRecord.entity_type.in_(OVERVIEW_ENTITIES),
            )
        )
    )
    publications = [row for row in rows if row.entity_type == "Publicacao"]
    assets = [row for row in rows if row.entity_type == "Asset"]
    jobs = [row for row in rows if row.entity_type == "ProcessamentoJob"]
    audit_events = (
        session.scalar(
            select(func.count()).where(
                TenantRecord.tenant_id == membership.tenant_id,
                TenantRecord.entity_type == "LogAuditoria",
            )
        )
        or 0
    )
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
                "date": _text(row.data.get("data_agendada") or row.data.get("scheduled_at")),
                "platform": row.data.get("plataforma") or row.data.get("platform") or "",
                "status": row.data.get("status") or row.data.get("situacao") or "Pendente",
            }
            for row in publications
        ),
        key=lambda item: item["date"],
    )[:8]
    indexed = sum(
        _status(row.data) in {"indexado", "indexed", "concluido", "completed"} for row in assets
    )
    failures = sum(_status(row.data) in {"falha", "failed", "erro", "error"} for row in assets)
    storage_bytes = sum(_size(row.data.get("file_size") or row.data.get("size")) for row in assets)

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
            "total": len(jobs),
            "active": sum(
                _status(row.data) in {"processando", "processing", "queued", "na_fila"}
                for row in jobs
            ),
            "completed": sum(_status(row.data) in {"concluido", "completed"} for row in jobs),
            "failed": sum(
                _status(row.data) in {"falha", "failed", "erro", "error"} for row in jobs
            ),
        },
        "audit_events": audit_events,
        "services": [
            # The API state is this very response: if it is being served, the API answered.
            {"key": "api", "label": "API", "status": "ok", "detail": "Respondendo"},
            _database_service(session),
        ],
    }

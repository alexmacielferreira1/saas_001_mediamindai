from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.identity import TenantRecord
from app.tenancy.context import CurrentSession, get_current_session, require_membership

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]

ROLE_LABELS = {
    "editor": [
        "Em edição",
        "Entregas hoje",
        "Revisões",
        "Materiais",
        "Aprovações",
        "Cortes",
        "Tarefas",
        "Projetos",
    ],
    "producer": [
        "Em produção",
        "Agendadas hoje",
        "Gravações",
        "Roteiros",
        "Aprovações",
        "Publicações",
        "Pendências",
        "Projetos",
    ],
    "default": [
        "Produções",
        "Finalizadas",
        "Em edição",
        "Aprovações",
        "Processamentos",
        "Publicações",
        "Pendências",
        "Projetos",
    ],
}


# Linhas de trilha/medição: nunca entram nas contagens do painel (podem ser milhares).
NON_PROJECT_ENTITIES = ("LogAuditoria", "AIUsageEvent")
COUNTED_ENTITIES = (
    "ProducaoProjeto",
    "AprovacaoItem",
    "AprovacaoVersao",
    "ProcessamentoJob",
    "Publicacao",
    "PendenciaCorp",
)


def entity_counts(session: Session, tenant_id) -> dict[str, int]:
    rows = session.execute(
        select(TenantRecord.entity_type, func.count())
        .where(
            TenantRecord.tenant_id == tenant_id,
            TenantRecord.entity_type.in_(COUNTED_ENTITIES),
        )
        .group_by(TenantRecord.entity_type)
    )
    return {entity_type: count for entity_type, count in rows}


def production_stage_counts(session: Session, tenant_id) -> dict[str | None, int]:
    stage = TenantRecord.data["etapa"].as_string()
    rows = session.execute(
        select(stage, func.count())
        .where(
            TenantRecord.tenant_id == tenant_id,
            TenantRecord.entity_type == "ProducaoProjeto",
        )
        .group_by(stage)
    )
    return {value: count for value, count in rows}


def distinct_project_count(session: Session, tenant_id) -> int:
    project_id = TenantRecord.data["project_id"].as_string()
    return (
        session.scalar(
            select(func.count(distinct(project_id))).where(
                TenantRecord.tenant_id == tenant_id,
                TenantRecord.entity_type.not_in(NON_PROJECT_ENTITIES),
                project_id.is_not(None),
                project_id != "",
            )
        )
        or 0
    )


@router.get("/me")
def dashboard_me(current: Authenticated, session: DbSession):
    """KPIs do painel com contagens no SQL (auditoria 2026-10-23, #8)."""
    membership = require_membership(current)
    counts = entity_counts(session, membership.tenant_id)
    stages = production_stage_counts(session, membership.tenant_id)
    values = [
        counts.get("ProducaoProjeto", 0),
        stages.get("finalizado", 0),
        stages.get("em_edicao", 0),
        counts.get("AprovacaoItem", 0) + counts.get("AprovacaoVersao", 0),
        counts.get("ProcessamentoJob", 0),
        counts.get("Publicacao", 0),
        counts.get("PendenciaCorp", 0),
        distinct_project_count(session, membership.tenant_id),
    ]
    ids = [
        "productions",
        "finished",
        "editing",
        "approvals",
        "processing",
        "publications",
        "pending",
        "projects",
    ]
    labels = ROLE_LABELS.get(membership.role, ROLE_LABELS["default"])
    agenda = session.scalars(
        select(TenantRecord).where(
            TenantRecord.tenant_id == membership.tenant_id,
            TenantRecord.entity_type == "AgendaEvento",
        )
    )
    events = sorted(
        agenda,
        key=lambda item: (item.data.get("day", 999), item.data.get("horario", "")),
    )[:6]
    return {
        "role": membership.role,
        "kpis": [
            {"id": identifier, "label": label, "value": value}
            for identifier, label, value in zip(ids, labels, values, strict=True)
        ],
        "upcoming_events": [
            {
                "title": item.data.get("titulo", "Evento"),
                "time": item.data.get("horario", ""),
                "status": item.data.get("status", ""),
                "project": item.data.get("programa", ""),
            }
            for item in events
        ],
    }

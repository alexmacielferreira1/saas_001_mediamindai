from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.identity import TenantRecord
from app.tenancy.context import CurrentSession, get_current_session, require_membership

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]

ROLE_LABELS = {
    "editor": ["Em edição", "Entregas hoje", "Revisões", "Materiais", "Aprovações", "Cortes", "Tarefas", "Projetos"],
    "producer": ["Em produção", "Agendadas hoje", "Gravações", "Roteiros", "Aprovações", "Publicações", "Pendências", "Projetos"],
    "default": ["Produções", "Finalizadas", "Em edição", "Aprovações", "Processamentos", "Publicações", "Pendências", "Projetos"],
}


@router.get("/me")
def dashboard_me(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    rows = list(session.scalars(select(TenantRecord).where(
        TenantRecord.tenant_id == membership.tenant_id,
    )))
    by_type = {}
    for item in rows:
        by_type.setdefault(item.entity_type, []).append(item)
    productions = by_type.get("ProducaoProjeto", [])
    values = [
        len(productions),
        sum(item.data.get("etapa") == "finalizado" for item in productions),
        sum(item.data.get("etapa") == "em_edicao" for item in productions),
        len(by_type.get("AprovacaoItem", [])) + len(by_type.get("AprovacaoVersao", [])),
        len(by_type.get("ProcessamentoJob", [])),
        len(by_type.get("Publicacao", [])),
        len(by_type.get("PendenciaCorp", [])),
        len({item.data.get("project_id") for item in rows if item.data.get("project_id")}),
    ]
    ids = ["productions", "finished", "editing", "approvals", "processing", "publications", "pending", "projects"]
    labels = ROLE_LABELS.get(membership.role, ROLE_LABELS["default"])
    events = sorted(
        by_type.get("AgendaEvento", []),
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

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import TenantRecord
from app.schemas.records import (
    BulkUpdateResult,
    RecordBulkCreate,
    RecordBulkUpdate,
    RecordCreate,
    RecordList,
    RecordPatch,
    RecordQuery,
)
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission
from app.tenancy.record_policies import RECORD_WRITE_PERMISSIONS

router = APIRouter(prefix="/records", tags=["records"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
ALLOWED_TYPES = {
    "AgendaEvento",
    "AprovacaoItem",
    "AprovacaoVersao",
    "Asset",
    "BriefingProducao",
    "Clip",
    "ClipCandidate",
    "ClipVersion",
    "Clipping",
    "ComentarioRevisao",
    "DireitoAsset",
    "Jornalista",
    "LogAuditoria",
    "Mencao",
    "PendenciaCorp",
    "ProcessamentoJob",
    "ProducaoProjeto",
    "Publicacao",
    "Release",
    "Script",
    "ScriptTemplate",
    "TranscricaoSegmento",
}


def validate_type(entity_type: str) -> None:
    if entity_type not in ALLOWED_TYPES:
        raise PublicError(404, "ENTITY_NOT_FOUND", "Tipo de registro não encontrado.")


def require_write(session: Session, current: CurrentSession, entity_type: str) -> None:
    membership = require_membership(current)
    if membership.role == "viewer":
        raise PublicError(403, "PERMISSION_DENIED", "Seu perfil permite somente leitura.")
    if entity_type == "LogAuditoria":
        raise PublicError(403, "AUDIT_APPEND_ONLY", "A auditoria é gravada somente pelo servidor.")
    require_permission(session, current, RECORD_WRITE_PERMISSIONS[entity_type])


def add_audit(
    session: Session,
    current: CurrentSession,
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict[str, Any] | None = None,
) -> None:
    membership = require_membership(current)
    session.add(
        TenantRecord(
            tenant_id=membership.tenant_id,
            entity_type="LogAuditoria",
            data={
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "user_id": str(current.user.id),
                "details": details or {},
            },
        )
    )


def serialize(record: TenantRecord) -> dict[str, Any]:
    return {
        **record.data,
        "id": str(record.id),
        "created_date": record.created_at.isoformat(),
        "updated_date": record.updated_at.isoformat(),
    }


def matches(record: TenantRecord, filters: dict[str, Any]) -> bool:
    return all(record.data.get(key) == value for key, value in filters.items())


def load_records(session: Session, tenant_id: UUID, entity_type: str) -> list[TenantRecord]:
    return list(
        session.scalars(
            select(TenantRecord).where(
                TenantRecord.tenant_id == tenant_id,
                TenantRecord.entity_type == entity_type,
            )
        )
    )


def find_record(
    session: Session, tenant_id: UUID, entity_type: str, record_id: UUID
) -> TenantRecord:
    record = session.scalar(
        select(TenantRecord).where(
            TenantRecord.id == record_id,
            TenantRecord.tenant_id == tenant_id,
            TenantRecord.entity_type == entity_type,
        )
    )
    if record is None:
        raise PublicError(404, "RECORD_NOT_FOUND", "Registro não encontrado.")
    return record


def ordered(records: list[TenantRecord], sort: str, limit: int) -> list[TenantRecord]:
    descending = sort.startswith("-")
    field = sort.removeprefix("-")

    def key(item: TenantRecord):
        if field == "created_date":
            return item.created_at
        if field == "updated_date":
            return item.updated_at
        value = item.data.get(field)
        return (value is None, value)

    return sorted(records, key=key, reverse=descending)[:limit]


@router.get("/{entity_type}", response_model=RecordList)
def list_records(
    entity_type: str,
    current: Authenticated,
    session: DbSession,
    sort: str = "-created_date",
    limit: int = 100,
):
    validate_type(entity_type)
    membership = require_membership(current)
    safe_limit = max(1, min(limit, 500))
    rows = ordered(load_records(session, membership.tenant_id, entity_type), sort, safe_limit)
    return RecordList(records=[serialize(item) for item in rows])


@router.post("/{entity_type}/query", response_model=RecordList)
def query_records(entity_type: str, body: RecordQuery, current: Authenticated, session: DbSession):
    validate_type(entity_type)
    membership = require_membership(current)
    rows = [
        item
        for item in load_records(session, membership.tenant_id, entity_type)
        if matches(item, body.filters)
    ]
    return RecordList(records=[serialize(item) for item in ordered(rows, body.sort, body.limit)])


@router.post("/{entity_type}/bulk", status_code=201, response_model=RecordList)
def bulk_create(
    entity_type: str, body: RecordBulkCreate, current: Authenticated, session: DbSession
):
    validate_type(entity_type)
    require_write(session, current, entity_type)
    membership = require_membership(current)
    rows = [
        TenantRecord(tenant_id=membership.tenant_id, entity_type=entity_type, data=item)
        for item in body.items
    ]
    session.add_all(rows)
    session.flush()
    add_audit(session, current, "records.bulk_created", entity_type, "bulk", {"count": len(rows)})
    session.commit()
    return RecordList(records=[serialize(item) for item in rows])


@router.patch("/{entity_type}/bulk", response_model=BulkUpdateResult)
def bulk_update(
    entity_type: str, body: RecordBulkUpdate, current: Authenticated, session: DbSession
):
    validate_type(entity_type)
    require_write(session, current, entity_type)
    membership = require_membership(current)
    rows = [
        item
        for item in load_records(session, membership.tenant_id, entity_type)
        if matches(item, body.filters)
    ]
    for item in rows:
        item.data = {**item.data, **body.data}
    add_audit(session, current, "records.bulk_updated", entity_type, "bulk", {"count": len(rows)})
    session.commit()
    return BulkUpdateResult(updated=len(rows))


@router.post("/{entity_type}", status_code=201)
def create_record(entity_type: str, body: RecordCreate, current: Authenticated, session: DbSession):
    validate_type(entity_type)
    require_write(session, current, entity_type)
    membership = require_membership(current)
    record = TenantRecord(tenant_id=membership.tenant_id, entity_type=entity_type, data=body.data)
    session.add(record)
    session.flush()
    add_audit(session, current, "record.created", entity_type, str(record.id))
    session.commit()
    return serialize(record)


@router.get("/{entity_type}/{record_id}")
def get_record(entity_type: str, record_id: UUID, current: Authenticated, session: DbSession):
    validate_type(entity_type)
    membership = require_membership(current)
    return serialize(find_record(session, membership.tenant_id, entity_type, record_id))


@router.patch("/{entity_type}/{record_id}")
def update_record(
    entity_type: str, record_id: UUID, body: RecordPatch, current: Authenticated, session: DbSession
):
    validate_type(entity_type)
    require_write(session, current, entity_type)
    membership = require_membership(current)
    record = find_record(session, membership.tenant_id, entity_type, record_id)
    record.data = {**record.data, **body.data}
    add_audit(session, current, "record.updated", entity_type, str(record.id))
    session.commit()
    return serialize(record)


@router.delete("/{entity_type}/{record_id}", status_code=204)
def delete_record(entity_type: str, record_id: UUID, current: Authenticated, session: DbSession):
    validate_type(entity_type)
    require_write(session, current, entity_type)
    membership = require_membership(current)
    record = find_record(session, membership.tenant_id, entity_type, record_id)
    session.delete(record)
    add_audit(session, current, "record.deleted", entity_type, str(record.id))
    session.commit()
    return Response(status_code=204)

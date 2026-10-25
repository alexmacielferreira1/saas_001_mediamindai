from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.v1.records import add_audit
from app.core.config import ROOT, get_settings
from app.core.errors import PublicError
from app.creative.storage import store_creative_export
from app.db.session import get_session, release_connection
from app.models.identity import TenantRecord
from app.schemas.creative_tools import (
    CreativeDocumentApprove,
    CreativeDocumentCreate,
    CreativeDocumentList,
    CreativeDocumentPatch,
    CreativeDocumentPublic,
    CreativeExportPublic,
)
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(tags=["creative-tools"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
# Pasta fixa usada até 2026-10-24 (não seguia MEDIA_ROOT). Novos ZIPs vão para
# ``MEDIA_ROOT/creative-exports``; o download continua achando os antigos aqui, com o mesmo
# ``relative_path`` (``<empresa>/<arquivo>.zip``).
LEGACY_CREATIVE_EXPORT_ROOT = ROOT / ".runtime" / "creative-exports"
MAX_CREATIVE_EXPORT_BYTES = 200 * 1024 * 1024


def creative_export_root() -> Path:
    return get_settings().media_root / "creative-exports"


def serialize_document(record: TenantRecord) -> dict:
    return {
        "id": str(record.id),
        **record.data,
        "created_date": record.created_at.isoformat(),
        "updated_date": record.updated_at.isoformat(),
    }


def find_document(
    session: Session, current: CurrentSession, document_id: UUID, *, lock: bool = False
) -> TenantRecord:
    membership = require_membership(current)
    statement = select(TenantRecord).where(
        TenantRecord.id == document_id,
        TenantRecord.tenant_id == membership.tenant_id,
        TenantRecord.entity_type == "CreativeDocument",
    )
    if lock:
        # Edição e aprovação da mesma linha em fila (PostgreSQL): a revisão lida é a atual.
        statement = statement.with_for_update().execution_options(populate_existing=True)
    record = session.scalar(statement)
    if record is None:
        raise PublicError(404, "CREATIVE_DOCUMENT_NOT_FOUND", "Documento não encontrado.")
    return record


@router.get("/creative-documents", response_model=CreativeDocumentList)
def list_creative_documents(
    current: Authenticated,
    session: DbSession,
    tool_type: Literal["carousel"] | None = Query(default=None),
):
    membership = require_membership(current)
    records = list(
        session.scalars(
            select(TenantRecord)
            .where(
                TenantRecord.tenant_id == membership.tenant_id,
                TenantRecord.entity_type == "CreativeDocument",
            )
            .order_by(TenantRecord.updated_at.desc())
        )
    )
    if tool_type:
        records = [item for item in records if item.data.get("tool_type") == tool_type]
    return {"documents": [serialize_document(item) for item in records]}


@router.post("/creative-documents", status_code=201, response_model=CreativeDocumentPublic)
def create_creative_document(
    body: CreativeDocumentCreate,
    current: Authenticated,
    session: DbSession,
):
    require_permission(session, current, "production.write")
    membership = require_membership(current)
    record = TenantRecord(
        tenant_id=membership.tenant_id,
        entity_type="CreativeDocument",
        data={
            "tool_type": body.tool_type,
            "content": body.content.model_dump(mode="json"),
            "revision": 1,
            "status": "draft",
            "approved_revision": None,
        },
    )
    session.add(record)
    session.flush()
    add_audit(session, current, "creative_document.created", "CreativeDocument", str(record.id))
    session.commit()
    session.refresh(record)
    return serialize_document(record)


@router.get("/creative-documents/{document_id}", response_model=CreativeDocumentPublic)
def get_creative_document(document_id: UUID, current: Authenticated, session: DbSession):
    return serialize_document(find_document(session, current, document_id))


@router.patch("/creative-documents/{document_id}", response_model=CreativeDocumentPublic)
def update_creative_document(
    document_id: UUID,
    body: CreativeDocumentPatch,
    current: Authenticated,
    session: DbSession,
):
    require_permission(session, current, "production.write")
    record = find_document(session, current, document_id, lock=True)
    next_revision = int(record.data.get("revision", 0)) + 1
    record.data = {
        **record.data,
        "content": body.content.model_dump(mode="json"),
        "revision": next_revision,
        "status": "draft",
    }
    add_audit(
        session,
        current,
        "creative_document.updated",
        "CreativeDocument",
        str(record.id),
        {"revision": next_revision},
    )
    session.commit()
    session.refresh(record)
    return serialize_document(record)


@router.post("/creative-documents/{document_id}/approve", response_model=CreativeDocumentPublic)
def approve_creative_document(
    document_id: UUID,
    current: Authenticated,
    session: DbSession,
    body: CreativeDocumentApprove | None = None,
):
    require_permission(session, current, "review.write")
    record = find_document(session, current, document_id, lock=True)
    revision = int(record.data["revision"])
    if body is not None and body.revision is not None and body.revision != revision:
        # Outra edição chegou depois da revisão vista: aprovar agora aprovaria algo não lido.
        raise PublicError(
            409,
            "CREATIVE_REVISION_CONFLICT",
            "O documento mudou depois da sua revisão. Revise a versão atual antes de aprovar.",
        )
    record.data = {**record.data, "status": "approved", "approved_revision": revision}
    add_audit(
        session,
        current,
        "creative_document.approved",
        "CreativeDocument",
        str(record.id),
        {"revision": revision},
    )
    session.commit()
    session.refresh(record)
    return serialize_document(record)


def find_export(session: Session, current: CurrentSession, export_id: UUID) -> TenantRecord:
    membership = require_membership(current)
    record = session.scalar(
        select(TenantRecord).where(
            TenantRecord.id == export_id,
            TenantRecord.tenant_id == membership.tenant_id,
            TenantRecord.entity_type == "CreativeExport",
        )
    )
    if record is None:
        raise PublicError(404, "CREATIVE_EXPORT_NOT_FOUND", "Exportação não encontrada.")
    return record


@router.post(
    "/creative-documents/{document_id}/exports",
    status_code=201,
    response_model=CreativeExportPublic,
)
async def create_creative_export(
    document_id: UUID,
    current: Authenticated,
    session: DbSession,
    revision: Annotated[int, Form(ge=1)],
    preset: Annotated[str, Form(min_length=1, max_length=80)],
    file: Annotated[UploadFile, File()],
):
    require_permission(session, current, "production.write")
    membership = require_membership(current)
    document = find_document(session, current, document_id)
    if int(document.data["revision"]) != revision:
        raise PublicError(
            409,
            "CREATIVE_REVISION_CONFLICT",
            "O documento mudou. Gere a exportação novamente.",
        )
    if (file.content_type or "").lower() not in {"application/zip", "application/x-zip-compressed"}:
        raise PublicError(422, "INVALID_FILE_TYPE", "A exportação deve ser um arquivo ZIP.")
    # Recebimento e gravação do ZIP sem conexão do pool presa.
    release_connection(session)
    content = await file.read(MAX_CREATIVE_EXPORT_BYTES + 1)
    await file.close()
    if len(content) > MAX_CREATIVE_EXPORT_BYTES:
        raise PublicError(413, "FILE_TOO_LARGE", "Exportação excede o limite permitido.")
    if not content.startswith(b"PK"):
        raise PublicError(422, "INVALID_ZIP", "Arquivo ZIP inválido.")
    # Escrita de até 200 MB fora do event loop.
    export_root = creative_export_root()
    stored = await run_in_threadpool(
        store_creative_export, export_root, membership.tenant_id, content
    )
    record = TenantRecord(
        tenant_id=membership.tenant_id,
        entity_type="CreativeExport",
        data={
            "document_id": str(document.id),
            "revision": revision,
            "preset": preset,
            "status": "ready",
            "sha256": stored.sha256,
            "size": stored.size,
            "relative_path": stored.relative_path,
        },
    )
    try:
        session.add(record)
        session.flush()
        add_audit(
            session,
            current,
            "creative_export.ready",
            "CreativeExport",
            str(record.id),
            {"document_id": str(document.id), "revision": revision},
        )
        session.commit()
    except Exception:
        # Sem registro, o ZIP gravado ficaria órfão no disco.
        session.rollback()
        (export_root / stored.relative_path).unlink(missing_ok=True)
        raise
    session.refresh(record)
    return {
        "id": str(record.id),
        **record.data,
        "created_date": record.created_at.isoformat(),
    }


def resolve_export_path(tenant_id: UUID, data: dict) -> Path | None:
    """Resolve o ZIP só dentro da pasta da empresa da sessão (defesa em profundidade).

    ``relative_path`` é gravado pelo servidor, mas um valor absoluto, com ``..`` ou de outra
    empresa nunca pode sair de ``<raiz>/<tenant_id>``. Procura primeiro na raiz atual
    (``MEDIA_ROOT``) e depois na pasta legada, onde ficaram os ZIPs anteriores.
    """
    relative_path = data.get("relative_path")
    if not relative_path or not isinstance(relative_path, str):
        return None
    for root in (creative_export_root(), LEGACY_CREATIVE_EXPORT_ROOT):
        tenant_root = (root / str(tenant_id)).resolve()
        candidate = (root / relative_path).resolve()
        if candidate == tenant_root or not candidate.is_relative_to(tenant_root):
            return None
        if candidate.is_file():
            return candidate
    return None


@router.get("/creative-exports/{export_id}/download")
def download_creative_export(export_id: UUID, current: Authenticated, session: DbSession):
    record = find_export(session, current, export_id)
    source = resolve_export_path(require_membership(current).tenant_id, record.data)
    if source is None:
        raise PublicError(404, "CREATIVE_EXPORT_FILE_NOT_FOUND", "Arquivo não encontrado.")
    return FileResponse(source, media_type="application/zip", filename="carrossel.zip")

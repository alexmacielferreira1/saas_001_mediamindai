from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.records import add_audit
from app.core.config import ROOT
from app.core.errors import PublicError
from app.creative.storage import store_creative_export
from app.db.session import get_session
from app.models.identity import TenantRecord
from app.schemas.creative_tools import (
    CreativeDocumentCreate,
    CreativeDocumentList,
    CreativeDocumentPatch,
    CreativeDocumentPublic,
    CreativeExportPublic,
)
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(tags=['creative-tools'])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
CREATIVE_EXPORT_ROOT = ROOT / '.runtime' / 'creative-exports'
MAX_CREATIVE_EXPORT_BYTES = 200 * 1024 * 1024


def serialize_document(record: TenantRecord) -> dict:
    return {
        'id': str(record.id),
        **record.data,
        'created_date': record.created_at.isoformat(),
        'updated_date': record.updated_at.isoformat(),
    }


def find_document(
    session: Session, current: CurrentSession, document_id: UUID
) -> TenantRecord:
    membership = require_membership(current)
    record = session.scalar(
        select(TenantRecord).where(
            TenantRecord.id == document_id,
            TenantRecord.tenant_id == membership.tenant_id,
            TenantRecord.entity_type == 'CreativeDocument',
        )
    )
    if record is None:
        raise PublicError(404, 'CREATIVE_DOCUMENT_NOT_FOUND', 'Documento não encontrado.')
    return record


@router.get('/creative-documents', response_model=CreativeDocumentList)
def list_creative_documents(
    current: Authenticated,
    session: DbSession,
    tool_type: Literal['carousel'] | None = Query(default=None),
):
    membership = require_membership(current)
    records = list(
        session.scalars(
            select(TenantRecord)
            .where(
                TenantRecord.tenant_id == membership.tenant_id,
                TenantRecord.entity_type == 'CreativeDocument',
            )
            .order_by(TenantRecord.updated_at.desc())
        )
    )
    if tool_type:
        records = [item for item in records if item.data.get('tool_type') == tool_type]
    return {'documents': [serialize_document(item) for item in records]}


@router.post('/creative-documents', status_code=201, response_model=CreativeDocumentPublic)
def create_creative_document(
    body: CreativeDocumentCreate,
    current: Authenticated,
    session: DbSession,
):
    require_permission(session, current, 'production.write')
    membership = require_membership(current)
    record = TenantRecord(
        tenant_id=membership.tenant_id,
        entity_type='CreativeDocument',
        data={
            'tool_type': body.tool_type,
            'content': body.content.model_dump(mode='json'),
            'revision': 1,
            'status': 'draft',
            'approved_revision': None,
        },
    )
    session.add(record)
    session.flush()
    add_audit(session, current, 'creative_document.created', 'CreativeDocument', str(record.id))
    session.commit()
    session.refresh(record)
    return serialize_document(record)


@router.get('/creative-documents/{document_id}', response_model=CreativeDocumentPublic)
def get_creative_document(document_id: UUID, current: Authenticated, session: DbSession):
    return serialize_document(find_document(session, current, document_id))


@router.patch('/creative-documents/{document_id}', response_model=CreativeDocumentPublic)
def update_creative_document(
    document_id: UUID,
    body: CreativeDocumentPatch,
    current: Authenticated,
    session: DbSession,
):
    require_permission(session, current, 'production.write')
    record = find_document(session, current, document_id)
    next_revision = int(record.data.get('revision', 0)) + 1
    record.data = {
        **record.data,
        'content': body.content.model_dump(mode='json'),
        'revision': next_revision,
        'status': 'draft',
    }
    add_audit(
        session,
        current,
        'creative_document.updated',
        'CreativeDocument',
        str(record.id),
        {'revision': next_revision},
    )
    session.commit()
    session.refresh(record)
    return serialize_document(record)


@router.post('/creative-documents/{document_id}/approve', response_model=CreativeDocumentPublic)
def approve_creative_document(
    document_id: UUID, current: Authenticated, session: DbSession
):
    require_permission(session, current, 'review.write')
    record = find_document(session, current, document_id)
    revision = int(record.data['revision'])
    record.data = {**record.data, 'status': 'approved', 'approved_revision': revision}
    add_audit(
        session,
        current,
        'creative_document.approved',
        'CreativeDocument',
        str(record.id),
        {'revision': revision},
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
            TenantRecord.entity_type == 'CreativeExport',
        )
    )
    if record is None:
        raise PublicError(404, 'CREATIVE_EXPORT_NOT_FOUND', 'Exportação não encontrada.')
    return record


@router.post(
    '/creative-documents/{document_id}/exports',
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
    require_permission(session, current, 'production.write')
    membership = require_membership(current)
    document = find_document(session, current, document_id)
    if int(document.data['revision']) != revision:
        raise PublicError(
            409,
            'CREATIVE_REVISION_CONFLICT',
            'O documento mudou. Gere a exportação novamente.',
        )
    if (file.content_type or '').lower() not in {'application/zip', 'application/x-zip-compressed'}:
        raise PublicError(422, 'INVALID_FILE_TYPE', 'A exportação deve ser um arquivo ZIP.')
    content = await file.read(MAX_CREATIVE_EXPORT_BYTES + 1)
    await file.close()
    if len(content) > MAX_CREATIVE_EXPORT_BYTES:
        raise PublicError(413, 'FILE_TOO_LARGE', 'Exportação excede o limite permitido.')
    if not content.startswith(b'PK'):
        raise PublicError(422, 'INVALID_ZIP', 'Arquivo ZIP inválido.')
    stored = store_creative_export(CREATIVE_EXPORT_ROOT, membership.tenant_id, content)
    record = TenantRecord(
        tenant_id=membership.tenant_id,
        entity_type='CreativeExport',
        data={
            'document_id': str(document.id),
            'revision': revision,
            'preset': preset,
            'status': 'ready',
            'sha256': stored.sha256,
            'size': stored.size,
            'relative_path': stored.relative_path,
        },
    )
    session.add(record)
    session.flush()
    add_audit(
        session,
        current,
        'creative_export.ready',
        'CreativeExport',
        str(record.id),
        {'document_id': str(document.id), 'revision': revision},
    )
    session.commit()
    session.refresh(record)
    return {
        'id': str(record.id),
        **record.data,
        'created_date': record.created_at.isoformat(),
    }


@router.get('/creative-exports/{export_id}/download')
def download_creative_export(export_id: UUID, current: Authenticated, session: DbSession):
    record = find_export(session, current, export_id)
    source = CREATIVE_EXPORT_ROOT / record.data['relative_path']
    if not source.is_file():
        raise PublicError(404, 'CREATIVE_EXPORT_FILE_NOT_FOUND', 'Arquivo não encontrado.')
    return FileResponse(source, media_type='application/zip', filename='carrossel.zip')

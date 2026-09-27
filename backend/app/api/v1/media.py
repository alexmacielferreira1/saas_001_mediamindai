from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import PublicError
from app.db.session import get_session
from app.media.assets import serialize_asset
from app.media.storage import LocalMediaStorage
from app.models.identity import TenantRecord
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/media", tags=["media"])
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
DbSession = Annotated[Session, Depends(get_session)]
MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024
ALLOWED_MEDIA = {
    ".aac": ("audio", {"audio/aac", "audio/x-aac"}),
    ".avi": ("video", {"video/x-msvideo"}),
    ".jpeg": ("image", {"image/jpeg"}),
    ".jpg": ("image", {"image/jpeg"}),
    ".m4a": ("audio", {"audio/mp4", "audio/x-m4a"}),
    ".mov": ("video", {"video/quicktime"}),
    ".mp3": ("audio", {"audio/mpeg"}),
    ".mp4": ("video", {"video/mp4", "application/mp4"}),
    ".ogg": ("audio", {"audio/ogg", "video/ogg"}),
    ".png": ("image", {"image/png"}),
    ".wav": ("audio", {"audio/wav", "audio/x-wav"}),
    ".webm": ("video", {"video/webm", "audio/webm"}),
    ".webp": ("image", {"image/webp"}),
}


def classify_upload(file: UploadFile) -> tuple[str, str]:
    suffix = Path(file.filename or "").suffix.lower()
    config = ALLOWED_MEDIA.get(suffix)
    if config is None or (file.content_type or "") not in config[1]:
        raise PublicError(422, "INVALID_MEDIA_TYPE", "Tipo de mídia não permitido.")
    return suffix, config[0]


@router.post("/assets", status_code=201)
async def upload_asset(
    current: Authenticated,
    session: DbSession,
    file: Annotated[UploadFile, File()],
):
    membership = require_membership(current)
    require_permission(session, current, "assets.write")
    suffix, asset_type = classify_upload(file)
    asset_id = uuid4()
    storage = LocalMediaStorage(get_settings().media_root)
    stored = await storage.save_original(
        membership.tenant_id,
        asset_id,
        file,
        get_settings().media_max_upload_bytes,
    )
    record = TenantRecord(
        id=asset_id,
        tenant_id=membership.tenant_id,
        entity_type="Asset",
        data={
            "filename": file.filename or f"media{suffix}",
            "title": Path(file.filename or "media").stem,
            "asset_type": asset_type,
            "mime_type": stored.mime_type,
            "file_size": stored.size,
            "sha256": stored.sha256,
            "storage_key": stored.relative_key,
            "media_status": "uploaded",
        },
    )
    session.add(record)
    try:
        session.commit()
    except Exception:
        session.rollback()
        storage.delete_asset(membership.tenant_id, asset_id)
        raise
    return serialize_asset(record)


@router.get("/assets")
def list_assets(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    records = list(
        session.scalars(
            select(TenantRecord)
            .where(
                TenantRecord.tenant_id == membership.tenant_id,
                TenantRecord.entity_type == "Asset",
            )
            .order_by(TenantRecord.created_at.desc())
        )
    )
    return {"assets": [serialize_asset(record) for record in records]}


def find_asset(session: Session, tenant_id: UUID, asset_id: UUID) -> TenantRecord:
    record = session.scalar(
        select(TenantRecord).where(
            TenantRecord.id == asset_id,
            TenantRecord.tenant_id == tenant_id,
            TenantRecord.entity_type == "Asset",
        )
    )
    if record is None:
        raise PublicError(404, "MEDIA_NOT_FOUND", "Mídia não encontrada.")
    return record


def parse_byte_range(value: str, size: int) -> tuple[int, int]:
    if not value.startswith("bytes=") or "," in value:
        raise ValueError
    start_text, separator, end_text = value.removeprefix("bytes=").partition("-")
    if not separator:
        raise ValueError
    if start_text:
        start = int(start_text)
        end = min(int(end_text), size - 1) if end_text else size - 1
    else:
        length = int(end_text)
        if length <= 0:
            raise ValueError
        start = max(0, size - length)
        end = size - 1
    if start < 0 or start >= size or end < start:
        raise ValueError
    return start, end


def iter_file_range(path: Path, start: int, end: int, chunk_size: int = 1024 * 1024):
    with path.open("rb") as source:
        source.seek(start)
        remaining = end - start + 1
        while remaining:
            chunk = source.read(min(chunk_size, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@router.get("/assets/{asset_id}/stream")
def stream_asset(asset_id: UUID, request: Request, current: Authenticated, session: DbSession):
    membership = require_membership(current)
    record = find_asset(session, membership.tenant_id, asset_id)
    storage = LocalMediaStorage(get_settings().media_root)
    source = storage.resolve(record.data["storage_key"])
    if not source.is_file():
        raise PublicError(404, "MEDIA_NOT_FOUND", "Mídia não encontrada.")
    size = source.stat().st_size
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=0"}
    range_value = request.headers.get("range")
    if not range_value:
        return FileResponse(
            source,
            media_type=record.data.get("mime_type") or "application/octet-stream",
            headers=headers,
        )
    try:
        start, end = parse_byte_range(range_value, size)
    except (TypeError, ValueError):
        return Response(status_code=416, headers={**headers, "Content-Range": f"bytes */{size}"})
    length = end - start + 1
    return StreamingResponse(
        iter_file_range(source, start, end),
        status_code=206,
        media_type=record.data.get("mime_type") or "application/octet-stream",
        headers={
            **headers,
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(length),
        },
    )

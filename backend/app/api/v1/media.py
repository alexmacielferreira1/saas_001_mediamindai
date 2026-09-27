from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, UploadFile
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

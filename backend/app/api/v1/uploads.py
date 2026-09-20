from hashlib import sha256
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse

from app.core.config import ROOT
from app.core.errors import PublicError
from app.tenancy.context import CurrentSession, get_current_session, require_membership

router = APIRouter(prefix="/uploads", tags=["uploads"])
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
UPLOAD_ROOT = ROOT / ".runtime" / "uploads"
MAX_UPLOAD_BYTES = 100 * 1024 * 1024
ALLOWED_SUFFIXES = {
    ".aac", ".avi", ".csv", ".doc", ".docx", ".jpeg", ".jpg", ".m4a",
    ".mov", ".mp3", ".mp4", ".ogg", ".pdf", ".png", ".ppt", ".pptx",
    ".txt", ".wav", ".webm", ".webp", ".xls", ".xlsx",
}


@router.post("", status_code=201)
async def upload_file(current: Authenticated, file: Annotated[UploadFile, File()]):
    membership = require_membership(current)
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise PublicError(422, "INVALID_FILE_TYPE", "Tipo de arquivo não permitido.")
    tenant_dir = UPLOAD_ROOT / str(membership.tenant_id)
    tenant_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4()}{suffix}"
    destination = tenant_dir / stored_name
    size = 0
    digest = sha256()
    try:
        with destination.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise PublicError(413, "FILE_TOO_LARGE", "Arquivo excede o limite permitido.")
                digest.update(chunk)
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await file.close()
    return {
        "file_url": f"/api/v1/uploads/{stored_name}",
        "size": size,
        "sha256": digest.hexdigest(),
    }


@router.get("/{stored_name}")
def download_file(stored_name: str, current: Authenticated):
    membership = require_membership(current)
    if Path(stored_name).name != stored_name:
        raise PublicError(404, "FILE_NOT_FOUND", "Arquivo não encontrado.")
    source = UPLOAD_ROOT / str(membership.tenant_id) / stored_name
    if not source.is_file():
        raise PublicError(404, "FILE_NOT_FOUND", "Arquivo não encontrado.")
    return FileResponse(source)

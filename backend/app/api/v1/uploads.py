from hashlib import sha256
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import ROOT, get_settings
from app.core.errors import PublicError
from app.db.session import get_session
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/uploads", tags=["uploads"])
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
DbSession = Annotated[Session, Depends(get_session)]
# Até 2026-10-24 os anexos iam para esta pasta fixa do checkout, que não segue MEDIA_ROOT
# (no Render, só o disco de MEDIA_ROOT é persistente). Novos envios vão para
# ``MEDIA_ROOT/uploads/<empresa>``; a leitura continua procurando aqui os arquivos antigos.
LEGACY_UPLOAD_ROOT = ROOT / ".runtime" / "uploads"
MAX_UPLOAD_BYTES = 100 * 1024 * 1024
ALLOWED_SUFFIXES = {
    ".aac",
    ".avi",
    ".csv",
    ".doc",
    ".docx",
    ".jpeg",
    ".jpg",
    ".m4a",
    ".mov",
    ".mp3",
    ".mp4",
    ".ogg",
    ".pdf",
    ".png",
    ".ppt",
    ".pptx",
    ".txt",
    ".wav",
    ".webm",
    ".webp",
    ".xls",
    ".xlsx",
}


def upload_root() -> Path:
    return get_settings().media_root / "uploads"


def upload_name_is_safe(stored_name: str) -> bool:
    # Só o nome gerado pelo servidor; arquivos ocultos (``.<uuid>.part`` em envio) e
    # caminhos nunca são servidos.
    return Path(stored_name).name == stored_name and not stored_name.startswith(".")


def find_upload(tenant_id, stored_name: str) -> Path | None:
    if not upload_name_is_safe(stored_name):
        return None
    for root in (upload_root(), LEGACY_UPLOAD_ROOT):
        candidate = root / str(tenant_id) / stored_name
        if candidate.is_file():
            return candidate
    return None


def stored_name_from_url(file_url: object) -> str | None:
    """Nome do anexo de ``/api/v1/uploads/<nome>``; outros endereços não são locais."""
    prefix = "/api/v1/uploads/"
    if not isinstance(file_url, str) or not file_url.startswith(prefix):
        return None
    stored_name = file_url.removeprefix(prefix)
    return stored_name if upload_name_is_safe(stored_name) else None


def delete_upload(tenant_id, stored_name: str) -> None:
    source = find_upload(tenant_id, stored_name)
    if source is not None:
        source.unlink(missing_ok=True)


@router.post("", status_code=201)
async def upload_file(
    current: Authenticated, session: DbSession, file: Annotated[UploadFile, File()]
):
    membership = require_membership(current)
    require_permission(session, current, "assets.write")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise PublicError(422, "INVALID_FILE_TYPE", "Tipo de arquivo não permitido.")
    tenant_dir = upload_root() / str(membership.tenant_id)
    tenant_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4()}{suffix}"
    destination = tenant_dir / stored_name
    temporary = tenant_dir / f".{stored_name}.part"
    size = 0
    digest = sha256()
    try:
        with temporary.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise PublicError(413, "FILE_TOO_LARGE", "Arquivo excede o limite permitido.")
                digest.update(chunk)
                output.write(chunk)
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
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
    source = find_upload(membership.tenant_id, stored_name)
    if source is None:
        raise PublicError(404, "FILE_NOT_FOUND", "Arquivo não encontrado.")
    # ``attachment``: o navegador baixa o arquivo em vez de interpretá-lo na origem da API.
    return FileResponse(source, filename=stored_name, content_disposition_type="attachment")

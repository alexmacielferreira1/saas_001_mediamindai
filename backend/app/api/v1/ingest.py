"""Ingest pela pasta de referência do servidor.

Fluxo local/intranet: o arquivo chega em ``INGEST_SOURCE_ROOT/<slug-da-empresa>/`` (entrada),
um pacote escolhe os arquivos e cada um é copiado para ``MEDIA_ROOT`` (destino) com o mesmo
registro de Asset do envio pelo navegador. A entrada nunca é alterada nem apagada.

A importação anda um arquivo por requisição (``import-next``): sem fila em segundo plano, o
navegador mostra o progresso real e um pacote interrompido retoma de onde parou. Conteúdo
idêntico (mesmo sha256) já no acervo não é copiado de novo.
"""

import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from starlette.concurrency import run_in_threadpool

from app.api.v1.media import ALLOWED_MEDIA, probe_media
from app.api.v1.records import add_audit
from app.core.config import get_settings
from app.core.errors import PublicError
from app.db.session import get_session, release_connection
from app.media.storage import LocalMediaStorage
from app.models.identity import TenantRecord
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/ingest", tags=["ingest"])
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
DbSession = Annotated[Session, Depends(get_session)]
ENTITY = "IngestPackage"
MAX_LISTED_FILES = 2000
MAX_PACKAGE_FILES = 500
FINISHED = {"imported", "duplicate"}
PRIMARY_MIME = {
    ".aac": "audio/aac",
    ".avi": "video/x-msvideo",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".m4a": "audio/mp4",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".ogg": "audio/ogg",
    ".png": "image/png",
    ".wav": "audio/wav",
    ".webm": "video/webm",
    ".webp": "image/webp",
}


class PackageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    folder: str | None = Field(default=None, max_length=180)
    program_name: str | None = Field(default=None, max_length=180)
    ai_enabled: bool = True
    files: list[str] = Field(min_length=1, max_length=MAX_PACKAGE_FILES)


def source_dir(current: CurrentSession) -> Path:
    root = get_settings().ingest_source_root
    if root is None:
        raise PublicError(
            409,
            "INGEST_SOURCE_NOT_CONFIGURED",
            "Pasta de referência não configurada no servidor (INGEST_SOURCE_ROOT).",
        )
    # O slug da empresa separa as entradas: uma empresa não enxerga a pasta de outra.
    folder = (root / current.tenant.slug).resolve()
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def resolve_source(base: Path, relative: str) -> Path | None:
    """Arquivo da entrada pelo caminho relativo; ``None`` se sair da pasta ou não existir."""
    if not relative or "\x00" in relative or Path(relative).is_absolute():
        return None
    candidate = (base / relative).resolve()
    # ``resolve`` segue links: um link apontando para fora da entrada é recusado aqui.
    if base not in candidate.parents or not candidate.is_file():
        return None
    return candidate


def scan_source(base: Path) -> tuple[list[dict[str, Any]], bool]:
    files: list[dict[str, Any]] = []
    for directory, folders, names in os.walk(base, followlinks=False):
        folders[:] = sorted(name for name in folders if not name.startswith("."))
        for name in sorted(names):
            path = Path(directory) / name
            suffix = path.suffix.lower()
            if name.startswith(".") or suffix not in ALLOWED_MEDIA or path.is_symlink():
                continue
            if len(files) >= MAX_LISTED_FILES:
                return files, True
            stat = path.stat()
            files.append(
                {
                    "path": path.relative_to(base).as_posix(),
                    "name": name,
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime, UTC).isoformat(),
                    "asset_type": ALLOWED_MEDIA[suffix][0],
                }
            )
    return files, False


def tenant_packages(session: Session, tenant_id: UUID) -> list[TenantRecord]:
    return list(
        session.scalars(
            select(TenantRecord)
            .where(TenantRecord.tenant_id == tenant_id, TenantRecord.entity_type == ENTITY)
            .order_by(TenantRecord.created_at.desc())
        )
    )


def find_package(session: Session, tenant_id: UUID, package_id: UUID) -> TenantRecord:
    record = session.scalar(
        select(TenantRecord)
        .where(
            TenantRecord.id == package_id,
            TenantRecord.tenant_id == tenant_id,
            TenantRecord.entity_type == ENTITY,
        )
        .with_for_update()
    )
    if record is None:
        raise PublicError(404, "INGEST_PACKAGE_NOT_FOUND", "Pacote de ingestão não encontrado.")
    return record


def summarize(data: dict[str, Any]) -> dict[str, Any]:
    items = data["items"]
    done = sum(item["status"] in FINISHED for item in items)
    failed = sum(item["status"] == "failed" for item in items)
    pending = len(items) - done - failed
    status = "processing" if pending else "failed" if failed else "completed"
    return {
        **data,
        "status": status,
        "progress": round(100 * (done + failed) / len(items)),
        "file_count": len(items),
        "failed_count": failed,
    }


def serialize_package(record: TenantRecord) -> dict[str, Any]:
    return {
        **record.data,
        "id": str(record.id),
        "created_date": record.created_at.isoformat(),
        "updated_date": record.updated_at.isoformat(),
    }


def update_item(record: TenantRecord, index: int, **changes: Any) -> dict[str, Any]:
    items = [dict(item) for item in record.data["items"]]
    items[index].update(changes)
    record.data = summarize({**record.data, "items": items})
    flag_modified(record, "data")
    return items[index]


@router.get("/source")
def list_source(current: Authenticated, session: DbSession):
    require_permission(session, current, "assets.write")
    base = source_dir(current)
    files, truncated = scan_source(base)
    imported: dict[str, str] = {}
    for package in tenant_packages(session, current.tenant.id):
        for item in package.data.get("items", []):
            if item.get("asset_id") and item["status"] in FINISHED:
                imported[f"{item['path']}|{item['size']}"] = item["asset_id"]
    for entry in files:
        entry["imported_asset_id"] = imported.get(f"{entry['path']}|{entry['size']}")
    return {"source_folder": str(base), "files": files, "truncated": truncated}


@router.get("/packages")
def list_packages(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    packages = tenant_packages(session, membership.tenant_id)
    return {"packages": [serialize_package(item) for item in packages]}


@router.post("/packages", status_code=201)
def create_package(payload: PackageCreate, current: Authenticated, session: DbSession):
    require_permission(session, current, "assets.write")
    base = source_dir(current)
    items = []
    for relative in dict.fromkeys(payload.files):
        source = resolve_source(base, relative)
        if source is None or source.suffix.lower() not in ALLOWED_MEDIA:
            raise PublicError(
                422,
                "INGEST_FILE_NOT_FOUND",
                f"Arquivo não encontrado na pasta de referência: {relative}",
            )
        items.append(
            {
                "path": source.relative_to(base).as_posix(),
                "name": source.name,
                "size": source.stat().st_size,
                "status": "pending",
            }
        )
    record = TenantRecord(
        id=uuid4(),
        tenant_id=current.tenant.id,
        entity_type=ENTITY,
        data=summarize(
            {
                "name": payload.name.strip(),
                "folder": (payload.folder or "").strip() or None,
                "program_name": payload.program_name or None,
                "ai_status": "pending" if payload.ai_enabled else "disabled",
                "source": "folder",
                "owner": current.user.email,
                "items": items,
            }
        ),
    )
    session.add(record)
    add_audit(
        session, current, "ingest.package.created", ENTITY, str(record.id), {"files": len(items)}
    )
    session.commit()
    return serialize_package(record)


@router.post("/packages/{package_id}/retry")
def retry_package(package_id: UUID, current: Authenticated, session: DbSession):
    """Volta para a fila os arquivos que falharam ou ficaram presos numa cópia interrompida."""
    require_permission(session, current, "assets.write")
    record = find_package(session, current.tenant.id, package_id)
    for index, item in enumerate(record.data["items"]):
        if item["status"] in {"failed", "importing"}:
            update_item(record, index, status="pending", error=None)
    session.commit()
    return serialize_package(record)


@router.post("/packages/{package_id}/import-next")
async def import_next(package_id: UUID, current: Authenticated, session: DbSession):
    """Copia o próximo arquivo pendente do pacote para o destino e cria o Asset."""
    require_permission(session, current, "assets.write")
    tenant_id = current.tenant.id
    base = source_dir(current)
    record = find_package(session, tenant_id, package_id)
    index = next(
        (i for i, item in enumerate(record.data["items"]) if item["status"] == "pending"), None
    )
    if index is None:
        return serialize_package(record)
    # Marca antes de copiar: outra aba que chame ao mesmo tempo pega o arquivo seguinte.
    item = update_item(record, index, status="importing")
    session.commit()

    source = resolve_source(base, item["path"])
    if source is None:
        update_item(
            record, index, status="failed", error="O arquivo não está mais na pasta de referência."
        )
        session.commit()
        return serialize_package(record)
    # A cópia de vídeos grandes leva minutos: não segurar conexão do pool enquanto grava.
    release_connection(session)
    storage = LocalMediaStorage(get_settings().media_root)
    asset_id = uuid4()
    suffix = source.suffix.lower()
    try:
        stored = await run_in_threadpool(
            storage.save_original_from_path,
            tenant_id,
            asset_id,
            source,
            mime_type=PRIMARY_MIME[suffix],
        )
    except OSError as error:
        storage.delete_asset(tenant_id, asset_id)
        record = find_package(session, tenant_id, package_id)
        update_item(
            record,
            index,
            status="failed",
            error=f"Não foi possível copiar o arquivo: {error.strerror or error}",
        )
        session.commit()
        return serialize_package(record)
    # ffprobe é subprocesso bloqueante (até 30 s): fora do event loop.
    media_metadata = await run_in_threadpool(
        probe_media, storage.resolve(stored.relative_key, tenant_id=tenant_id)
    )

    existing = session.scalar(
        select(TenantRecord.id).where(
            TenantRecord.tenant_id == tenant_id,
            TenantRecord.entity_type == "Asset",
            TenantRecord.data["sha256"].as_string() == stored.sha256,
        )
    )
    record = find_package(session, tenant_id, package_id)
    if existing is not None:
        # Mesmo conteúdo já está no acervo: aponta para ele e descarta a cópia nova.
        storage.delete_asset(tenant_id, asset_id)
        update_item(record, index, status="duplicate", asset_id=str(existing), error=None)
    else:
        data = record.data
        session.add(
            TenantRecord(
                id=asset_id,
                tenant_id=tenant_id,
                entity_type="Asset",
                data={
                    "filename": source.name,
                    "title": source.stem,
                    "asset_type": ALLOWED_MEDIA[suffix][0],
                    "mime_type": stored.mime_type,
                    "file_size": stored.size,
                    "sha256": stored.sha256,
                    "storage_key": stored.relative_key,
                    "media_status": "uploaded",
                    "origin": "ingest",
                    "ingest_package_id": str(record.id),
                    "package_name": data["name"],
                    "folder": data.get("folder"),
                    "program_name": data.get("program_name"),
                    "ai_status": data.get("ai_status"),
                    "source_path": item["path"],
                    "file_url": f"/api/v1/media/assets/{asset_id}/stream",
                    **media_metadata,
                },
            )
        )
        update_item(record, index, status="imported", asset_id=str(asset_id), error=None)
    try:
        session.commit()
    except Exception:
        session.rollback()
        if existing is None:
            # Sem registro, a cópia ficaria órfã no destino.
            storage.delete_asset(tenant_id, asset_id)
        raise
    return serialize_package(record)

"""Exportações salvas: a peça pronta vira um Asset do Acervo e ganha cópia na pasta de destino.

Antes, o MP4 gerado ficava em ``<empresa>/exports/<uuid>`` só para o download e era apagado em
24 h. Agora ele é movido para o armazenamento do Acervo (``MEDIA_ROOT``, registro ``Asset`` com
``origin="export"``) e, se ``EXPORT_ROOT`` estiver configurada, copiado para
``<EXPORT_ROOT>/<slug-da-empresa>/<AAAA-MM-DD>/<nome>``, a pasta legível da equipe/servidor.
A cópia nunca sobrescreve um arquivo existente e, se falhar, a exportação continua válida
(o motivo fica no Asset).
"""

import re
import shutil
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote
from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import get_settings
from app.media.storage import LocalMediaStorage
from app.models.identity import TenantRecord
from app.tenancy.context import CurrentSession

ASSET_HEADER = "X-MediaMind-Asset-Id"
PATH_HEADER = "X-MediaMind-Export-Path"


def safe_file_name(name: str, default: str = "MediaMind") -> str:
    stem = re.sub(r"[^\w.-]+", "-", Path(name).stem, flags=re.UNICODE).strip("-.")
    return f"{stem or default}{Path(name).suffix.lower()}"


def copy_to_export_root(slug: str, filename: str, source: Path) -> str | None:
    """Copia para a pasta de destino; devolve o caminho relativo a EXPORT_ROOT (ou None)."""
    root = get_settings().export_root
    if root is None:
        return None
    folder = root / slug / datetime.now(UTC).strftime("%Y-%m-%d")
    folder.mkdir(parents=True, exist_ok=True)
    name = safe_file_name(filename)
    target = folder / name
    counter = 2
    while target.exists():
        target = folder / f"{Path(name).stem} ({counter}){Path(name).suffix}"
        counter += 1
    temporary = target.with_name(f".{target.name}.part")
    try:
        shutil.copyfile(source, temporary)
        temporary.replace(target)
    except OSError:
        temporary.unlink(missing_ok=True)
        raise
    return target.relative_to(root).as_posix()


def record_export_copy(record: TenantRecord, slug: str, source: Path) -> None:
    """Copia o Asset para a pasta de destino e anota onde ficou (ou por que falhou)."""
    try:
        relative = copy_to_export_root(slug, record.data["filename"], source)
        changes: dict[str, Any] = {"export_path": relative, "export_copy_error": None}
    except OSError as error:
        changes = {
            "export_path": None,
            "export_copy_error": f"Não foi possível copiar para a pasta de destino: "
            f"{error.strerror or error}",
        }
    record.data = {**record.data, **changes}
    flag_modified(record, "data")


def save_export(
    session: Session,
    current: CurrentSession,
    rendered: Path,
    *,
    filename: str,
    kind: str,
    source_asset_ids: list[str],
    probe: Callable[[Path], dict],
) -> tuple[TenantRecord, Path]:
    """Transforma o MP4 renderizado num Asset do Acervo e copia para a pasta de destino."""
    tenant_id = current.tenant.id
    storage = LocalMediaStorage(get_settings().media_root)
    asset_id = uuid4()
    stored = storage.adopt_original(tenant_id, asset_id, rendered, mime_type="video/mp4")
    path = storage.resolve(stored.relative_key, tenant_id=tenant_id)
    record = TenantRecord(
        id=asset_id,
        tenant_id=tenant_id,
        entity_type="Asset",
        data={
            "filename": filename,
            "title": Path(filename).stem,
            "asset_type": "video",
            "mime_type": stored.mime_type,
            "file_size": stored.size,
            "sha256": stored.sha256,
            "storage_key": stored.relative_key,
            "media_status": "uploaded",
            "origin": "export",
            "export_kind": kind,
            "source_asset_ids": source_asset_ids,
            "exported_by": current.user.email,
            "file_url": f"/api/v1/media/assets/{asset_id}/stream",
            **probe(path),
        },
    )
    record_export_copy(record, current.tenant.slug, path)
    session.add(record)
    try:
        session.commit()
    except Exception:
        session.rollback()
        storage.delete_asset(tenant_id, asset_id)
        raise
    return record, path


def export_headers(record: TenantRecord) -> dict[str, str]:
    headers = {ASSET_HEADER: str(record.id)}
    if record.data.get("export_path"):
        # Cabeçalho HTTP só aceita latin-1: o caminho vai codificado em URL.
        headers[PATH_HEADER] = quote(record.data["export_path"])
    return headers

from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from uuid import UUID, uuid4


@dataclass(frozen=True)
class StoredCreativeExport:
    relative_path: str
    size: int
    sha256: str


def store_creative_export(root: Path, tenant_id: UUID, content: bytes) -> StoredCreativeExport:
    tenant_dir = root / str(tenant_id)
    tenant_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4()}.zip"
    destination = tenant_dir / stored_name
    temporary = tenant_dir / f".{stored_name}.tmp"
    try:
        temporary.write_bytes(content)
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        destination.unlink(missing_ok=True)
        raise
    return StoredCreativeExport(
        relative_path=f"{tenant_id}/{stored_name}",
        size=len(content),
        sha256=sha256(content).hexdigest(),
    )

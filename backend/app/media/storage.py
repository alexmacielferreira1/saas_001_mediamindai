from hashlib import sha256
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile

from app.core.errors import PublicError
from app.media.storage_backend import StoredMedia


class LocalMediaStorage:
    def __init__(self, root: Path):
        self.root = root.resolve()

    def asset_root(self, tenant_id: UUID, asset_id: UUID) -> Path:
        return self.root / str(tenant_id) / str(asset_id)

    async def save_original(
        self,
        tenant_id: UUID,
        asset_id: UUID,
        upload: UploadFile,
        max_bytes: int,
    ) -> StoredMedia:
        suffix = Path(upload.filename or "").suffix.lower()
        destination_dir = self.asset_root(tenant_id, asset_id) / "original"
        destination_dir.mkdir(parents=True, exist_ok=True)
        destination = destination_dir / f"source{suffix}"
        temporary = destination.with_suffix(f"{destination.suffix}.part")
        digest = sha256()
        size = 0
        try:
            with temporary.open("wb") as output:
                while chunk := await upload.read(1024 * 1024):
                    size += len(chunk)
                    if size > max_bytes:
                        raise PublicError(
                            413,
                            "FILE_TOO_LARGE",
                            "Arquivo excede o limite permitido.",
                        )
                    digest.update(chunk)
                    output.write(chunk)
            temporary.replace(destination)
        except Exception:
            temporary.unlink(missing_ok=True)
            destination.unlink(missing_ok=True)
            self._remove_empty_parents(destination_dir, self.root)
            raise
        finally:
            await upload.close()
        return StoredMedia(
            relative_key=destination.relative_to(self.root).as_posix(),
            size=size,
            sha256=digest.hexdigest(),
            mime_type=upload.content_type or "application/octet-stream",
        )

    def save_derived(
        self,
        tenant_id: UUID,
        asset_id: UUID,
        source: Path,
        *,
        filename: str,
        mime_type: str,
    ) -> StoredMedia:
        destination_dir = self.asset_root(tenant_id, asset_id) / "derived"
        destination_dir.mkdir(parents=True, exist_ok=True)
        destination = destination_dir / Path(filename).name
        temporary = destination.with_suffix(f"{destination.suffix}.part")
        digest = sha256()
        size = 0
        try:
            with source.open("rb") as input_file, temporary.open("wb") as output:
                while chunk := input_file.read(1024 * 1024):
                    size += len(chunk)
                    digest.update(chunk)
                    output.write(chunk)
            temporary.replace(destination)
        except Exception:
            temporary.unlink(missing_ok=True)
            destination.unlink(missing_ok=True)
            self._remove_empty_parents(destination_dir, self.root)
            raise
        return StoredMedia(
            relative_key=destination.relative_to(self.root).as_posix(),
            size=size,
            sha256=digest.hexdigest(),
            mime_type=mime_type,
        )

    def resolve_local(self, relative_key: str | None) -> Path:
        # Registros de mídia sem arquivo (ex.: criados só como metadados) não têm chave.
        if not relative_key or not isinstance(relative_key, str):
            raise PublicError(404, "MEDIA_NOT_FOUND", "Mídia não encontrada.")
        candidate = (self.root / relative_key).resolve()
        if self.root not in candidate.parents:
            raise PublicError(404, "MEDIA_NOT_FOUND", "Mídia não encontrada.")
        return candidate

    def resolve(self, relative_key: str | None) -> Path:
        return self.resolve_local(relative_key)

    def delete_asset(self, tenant_id: UUID, asset_id: UUID) -> None:
        root = self.asset_root(tenant_id, asset_id)
        if not root.exists():
            return
        for path in sorted(root.rglob("*"), reverse=True):
            if path.is_file():
                path.unlink(missing_ok=True)
            elif path.is_dir():
                path.rmdir()
        root.rmdir()

    @staticmethod
    def _remove_empty_parents(path: Path, stop: Path) -> None:
        current = path
        while current != stop and stop in current.parents:
            try:
                current.rmdir()
            except OSError:
                break
            current = current.parent

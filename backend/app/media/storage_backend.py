from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from uuid import UUID

from fastapi import UploadFile


@dataclass(frozen=True)
class StoredMedia:
    relative_key: str
    size: int
    sha256: str
    mime_type: str


class MediaStorage(Protocol):
    """Replaceable media persistence contract; local disk is the first backend."""

    async def save_original(
        self, tenant_id: UUID, asset_id: UUID, upload: UploadFile, max_bytes: int
    ) -> StoredMedia: ...

    def save_derived(
        self,
        tenant_id: UUID,
        asset_id: UUID,
        source: Path,
        *,
        filename: str,
        mime_type: str,
    ) -> StoredMedia: ...

    def resolve_local(self, relative_key: str) -> Path: ...

    def delete_asset(self, tenant_id: UUID, asset_id: UUID) -> None: ...

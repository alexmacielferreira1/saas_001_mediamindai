from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.media import find_asset
from app.clips.analysis import CommandAnalysisAdapter
from app.clips.captions import captions_for_candidate
from app.clips.transcription import CommandTranscriptionAdapter, TranscriptionUnavailable
from app.core.config import get_settings
from app.core.errors import PublicError
from app.db.session import get_session, release_connection
from app.media.storage import LocalMediaStorage
from app.models.identity import TenantRecord
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/clipsfree2", tags=["clipsfree2"])
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
DbSession = Annotated[Session, Depends(get_session)]


class CreateSessionBody(BaseModel):
    asset_id: UUID
    format: str = Field(pattern=r"^(9:16|1:1|16:9)$")
    caption_style: str = Field(min_length=1, max_length=64)


def serialize_session(record: TenantRecord) -> dict:
    data = record.data
    return {
        "id": str(record.id),
        "asset_id": data["asset_id"],
        "format": data["format"],
        "caption_style": data["caption_style"],
        "status": data["status"],
        "candidates": data.get("candidates", []),
        "message": data["message"],
    }


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def create_session(body: CreateSessionBody, current: Authenticated, session: DbSession):
    """Create a tenant-scoped CLIPSFREE2 session without inventing AI output."""
    require_permission(session, current, "clips.write")
    membership = require_membership(current)
    try:
        asset = find_asset(session, membership.tenant_id, body.asset_id)
    except PublicError as error:
        # find_asset sinaliza ausência com PublicError (nunca LookupError): manter o código
        # público próprio do CLIPSFREE2 que esta rota declara.
        raise PublicError(404, "CLIPSFREE2_ASSET_NOT_FOUND", "Mídia não encontrada.") from error

    result = {
        "status": "manual_review",
        "candidates": [],
        "message": (
            "A análise automática ainda não está configurada. "
            "Continue com o corte manual; nenhuma sugestão foi inventada."
        ),
    }
    try:
        source = LocalMediaStorage(get_settings().media_root).resolve(
            asset.data.get("storage_key"), tenant_id=asset.tenant_id
        )
        # Sem conexão do pool presa durante transcrição e análise (minutos).
        release_connection(session)
        segments = CommandTranscriptionAdapter.from_environment().transcribe(source)
        candidates = CommandAnalysisAdapter.from_environment().suggest(segments)
        result = {
            "status": "completed",
            "candidates": [
                {
                    **candidate.model_dump(),
                    "captions": [
                        caption.model_dump() for caption in captions_for_candidate(candidate)
                    ],
                }
                for candidate in candidates
            ],
            "message": "Análise concluída com trechos baseados na transcrição desta mídia.",
        }
    except (TranscriptionUnavailable, FileNotFoundError, KeyError):
        pass

    record = TenantRecord(
        tenant_id=membership.tenant_id,
        entity_type="ClipsFree2Session",
        data={
            "asset_id": str(body.asset_id),
            "format": body.format,
            "caption_style": body.caption_style,
            **result,
        },
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return serialize_session(record)

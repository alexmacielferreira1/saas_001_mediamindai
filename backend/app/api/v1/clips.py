from typing import Annotated
from uuid import UUID

from cryptography.fernet import InvalidToken
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.ai import ai_settings_record, connection_configuration, decrypt_ai_key
from app.clips.analysis import CommandAnalysisAdapter, RemoteAnalysisAdapter
from app.clips.captions import captions_for_candidate
from app.clips.service import ClipAnalysisService
from app.clips.transcription import (
    CommandTranscriptionAdapter,
    RemoteTranscriptionAdapter,
    TranscriptionUnavailable,
)
from app.core.config import get_settings
from app.core.errors import PublicError
from app.db.session import get_session
from app.media.storage import LocalMediaStorage
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/clips", tags=["clips"])
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
DbSession = Annotated[Session, Depends(get_session)]


class StartAnalysisBody(BaseModel):
    asset_id: UUID
    connection_id: str | None = None


def serialize_analysis(analysis: dict) -> dict:
    return analysis


@router.post("/analyses", status_code=status.HTTP_202_ACCEPTED)
def start_analysis(body: StartAnalysisBody, current: Authenticated, session: DbSession):
    """Create a durable analysis job; never return simulated candidates."""
    require_permission(session, current, "clips.write")
    membership = require_membership(current)
    service = ClipAnalysisService(session)
    connection = None
    try:
        if body.connection_id:
            settings = ai_settings_record(session, membership.tenant_id)
            connection = next(
                (
                    item
                    for item in connection_configuration(settings.data if settings else {}).get(
                        "connections", []
                    )
                    if item.get("id") == body.connection_id and item.get("enabled", True)
                ),
                None,
            )
            if connection is None or not connection.get("encrypted_key"):
                raise PublicError(
                    422,
                    "CLIP_AI_CONNECTION_INVALID",
                    "Escolha uma IA ativa e com créditos configurados.",
                )
        record = service.create(
            asset_id=body.asset_id,
            tenant_id=membership.tenant_id,
            requested_by=current.user.id,
        )
    except LookupError as error:
        raise PublicError(404, "ASSET_NOT_FOUND", "Mídia não encontrada.") from error

    if connection:
        record.data = {**record.data, "connection_id": connection["id"]}

    try:
        # Resolve only the tenant-owned asset key, never a browser-provided path.
        from app.api.v1.media import find_asset

        asset = find_asset(session, membership.tenant_id, body.asset_id)
        source = LocalMediaStorage(get_settings().media_root).resolve(asset.data["storage_key"])
        if connection:
            api_key = decrypt_ai_key(connection)
            segments = RemoteTranscriptionAdapter(connection, api_key).transcribe(source)
            candidates = RemoteAnalysisAdapter(connection, api_key).suggest(segments)
        else:
            segments = CommandTranscriptionAdapter.from_environment().transcribe(source)
            candidates = CommandAnalysisAdapter.from_environment().suggest(segments)
        service.save_transcript(record.id, membership.tenant_id, segments)
        service.save_candidates(
            record.id,
            membership.tenant_id,
            candidates,
            [captions_for_candidate(candidate) for candidate in candidates],
        )
    except (PublicError, TranscriptionUnavailable, FileNotFoundError, KeyError, InvalidToken):
        service.set_state(
            record.id,
            membership.tenant_id,
            "unavailable",
            "A transcrição ainda não está configurada para esta empresa. "
            "Configure um provedor para analisar esta mídia.",
        )
    session.commit()
    result = service.get_analysis(record.id, membership.tenant_id)
    assert result is not None
    return serialize_analysis(result)


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: UUID, current: Authenticated, session: DbSession):
    membership = require_membership(current)
    result = ClipAnalysisService(session).get_analysis(analysis_id, membership.tenant_id)
    if result is None:
        raise PublicError(404, "CLIP_ANALYSIS_NOT_FOUND", "Análise de cortes não encontrada.")
    return serialize_analysis(result)

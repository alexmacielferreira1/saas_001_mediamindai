from time import perf_counter
from typing import Annotated
from uuid import UUID

from cryptography.fernet import InvalidToken
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.api.v1.ai import ai_settings_record, connection_configuration, decrypt_ai_key
from app.api.v1.ai_usage import guard_budget, record_usage
from app.clips.analysis import (
    ANALYSIS_MAX_TOKENS,
    CommandAnalysisAdapter,
    RemoteAnalysisAdapter,
)
from app.clips.captions import captions_for_candidate
from app.clips.service import ClipAnalysisService
from app.clips.transcription import (
    CommandTranscriptionAdapter,
    RemoteTranscriptionAdapter,
    TranscriptionUnavailable,
)
from app.core.config import get_settings
from app.core.errors import PublicError
from app.db.session import get_session, release_connection
from app.media.storage import LocalMediaStorage
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/clips", tags=["clips"])
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
DbSession = Annotated[Session, Depends(get_session)]


class StartAnalysisBody(BaseModel):
    asset_id: UUID
    connection_id: str | None = None
    minimum: int = Field(default=20, ge=15, le=60)
    maximum: int = Field(default=60, ge=15, le=60)
    editorial_prompt: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def check_duration(self):
        if self.minimum > self.maximum:
            raise ValueError("A duração mínima não pode superar a máxima.")
        return self


def serialize_analysis(analysis: dict) -> dict:
    return analysis


def call_provider(session, tenant_id, user_id, connection, *, step, model, work):
    """Executa uma chamada ao provedor da empresa e registra o uso (sucesso ou erro).

    ``work`` devolve ``(resultado, usage)``; ``usage`` ``None`` marca o custo como desconhecido.
    A transcrição não devolve tokens: é registrada com zero tokens e precisa de preço
    cadastrado para o modelo (``whisper-1``), como qualquer outro modelo da política.
    """
    started = perf_counter()
    common = {
        "provider": connection.get("provider", ""),
        "model": model,
        "feature": f"auto-clips.{step}",
        "connection_id": connection.get("id"),
    }
    try:
        result, reported = work()
    except Exception as error:
        record_usage(
            session,
            tenant_id,
            user_id,
            **common,
            status="error",
            latency_ms=(perf_counter() - started) * 1000,
            error_code=getattr(error, "code", None) or type(error).__name__,
        )
        raise
    usage = reported or {}
    record_usage(
        session,
        tenant_id,
        user_id,
        **common,
        latency_ms=(perf_counter() - started) * 1000,
        input_tokens=usage.get("input_tokens", usage.get("prompt_tokens", 0)) or 0,
        output_tokens=usage.get("output_tokens", usage.get("completion_tokens", 0)) or 0,
        usage_known=reported is not None,
    )
    return result


@router.post("/analyses", status_code=status.HTTP_202_ACCEPTED)
def start_analysis(body: StartAnalysisBody, current: Authenticated, session: DbSession):
    """Create a durable analysis job; never return simulated candidates."""
    require_permission(session, current, "clips.write")
    membership = require_membership(current)
    service = ClipAnalysisService(session)
    connection = None
    try:
        settings = ai_settings_record(session, membership.tenant_id)
        configuration = connection_configuration(settings.data if settings else {})
        configured_connection_id = configuration.get("tool_connections", {}).get(
            "auto-clips", configuration.get("default_connection_id")
        )
        connection_id = (
            configured_connection_id
            if configuration.get("tool_connections", {}).get("auto-clips")
            else body.connection_id or configured_connection_id
        )
        if connection_id:
            connection = next(
                (
                    item
                    for item in configuration.get("connections", [])
                    if item.get("id") == connection_id and item.get("enabled", True)
                ),
                None,
            )
            if connection is None or not connection.get("encrypted_key"):
                raise PublicError(
                    422,
                    "CLIP_AI_CONNECTION_INVALID",
                    "Escolha uma IA ativa e com créditos configurados.",
                )
            # Política de IA da empresa (desativada, limites) antes de criar a análise e de
            # qualquer chamada paga ao provedor (revisão geral 2026-10-24, achado 6).
            guard_budget(
                session,
                membership.tenant_id,
                connection.get("provider", ""),
                connection.get("model", ""),
                max_tokens=ANALYSIS_MAX_TOKENS,
            )
        record = service.create(
            asset_id=body.asset_id,
            tenant_id=membership.tenant_id,
            requested_by=current.user.id,
        )
    except LookupError as error:
        raise PublicError(404, "ASSET_NOT_FOUND", "Mídia não encontrada.") from error

    record.data = {
        **record.data,
        "minimum": body.minimum,
        "maximum": body.maximum,
        "editorial_prompt": body.editorial_prompt,
        **({"connection_id": connection["id"]} if connection else {}),
    }

    try:
        # Resolve only the tenant-owned asset key, never a browser-provided path.
        from app.api.v1.media import find_asset

        asset = find_asset(session, membership.tenant_id, body.asset_id)
        source = LocalMediaStorage(get_settings().media_root).resolve(
            asset.data.get("storage_key"), tenant_id=asset.tenant_id
        )
        api_key = decrypt_ai_key(connection) if connection else None
        # Grava a análise como "queued" e devolve a conexão ao pool durante a transcrição
        # e a análise (minutos); o resultado é gravado numa nova transação.
        release_connection(session)
        if connection and connection.get("provider") == "anthropic":
            # O Claude não transcreve áudio: a transcrição usa o transcritor local do
            # servidor (CLIPS_TRANSCRIBER_COMMAND) e só a análise vai para o Claude.
            segments = CommandTranscriptionAdapter.from_environment().transcribe(source)
        elif connection:
            transcriber = RemoteTranscriptionAdapter(connection, api_key)
            segments = call_provider(
                session,
                membership.tenant_id,
                current.user.id,
                connection,
                step="transcription",
                model=connection.get("transcription_model", "whisper-1"),
                work=lambda: (transcriber.transcribe(source), {}),
            )
        if connection:
            analyzer = RemoteAnalysisAdapter(connection, api_key)

            def analyze():
                proposals = analyzer.suggest(
                    segments,
                    minimum=body.minimum,
                    maximum=body.maximum,
                    editorial_prompt=body.editorial_prompt,
                )
                return proposals, getattr(analyzer, "usage", None) or None

            candidates = call_provider(
                session,
                membership.tenant_id,
                current.user.id,
                connection,
                step="analysis",
                model=connection.get("model", ""),
                work=analyze,
            )
        else:
            segments = CommandTranscriptionAdapter.from_environment().transcribe(source)
            candidates = CommandAnalysisAdapter.from_environment().suggest(segments)
        # Duration constraints are enforced server-side, including command-based providers.
        candidates = [
            candidate
            for candidate in candidates
            if body.minimum <= candidate.duration <= body.maximum
        ]
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
    except Exception:
        # A análise já foi gravada antes do trabalho longo: não deixá-la presa em "queued".
        session.rollback()
        try:
            service.set_state(
                record.id,
                membership.tenant_id,
                "failed",
                "A análise falhou. Tente novamente.",
            )
            session.commit()
        except Exception:
            session.rollback()
        raise
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

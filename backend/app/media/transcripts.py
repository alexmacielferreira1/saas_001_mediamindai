"""Transcrição de um Asset com o transcritor local (Whisper) e gravação dos trechos.

Os trechos ficam em ``TranscricaoSegmento`` (o formato que Workspace, Pesquisa e ClipsFree já
leem: ``asset_id``, ``start_ms``, ``end_ms``, ``texto``). O estado fica no próprio Asset
(``transcription_status``: processing → done | failed), o que impede duas transcrições
simultâneas da mesma mídia e deixa o motivo da falha visível.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from starlette.concurrency import run_in_threadpool

from app.clips.transcription import CommandTranscriptionAdapter, TranscriptionUnavailable
from app.core.config import get_settings
from app.core.errors import PublicError
from app.db.session import release_connection
from app.media.storage import LocalMediaStorage
from app.models.identity import TenantRecord

SEGMENT_ENTITY = "TranscricaoSegmento"
TRANSCRIBABLE = {"audio", "video"}
# Uma transcrição "processing" mais velha que isto foi interrompida (servidor reiniciado).
STALE_AFTER = timedelta(hours=3)


def update_asset(record: TenantRecord, **changes: Any) -> None:
    record.data = {**record.data, **changes}
    flag_modified(record, "data")


def asset_segments(session: Session, tenant_id: UUID, asset_id: UUID) -> list[TenantRecord]:
    return list(
        session.scalars(
            select(TenantRecord).where(
                TenantRecord.tenant_id == tenant_id,
                TenantRecord.entity_type == SEGMENT_ENTITY,
                TenantRecord.data["asset_id"].as_string() == str(asset_id),
            )
        )
    )


def saved_segments(session: Session, tenant_id: UUID, asset_id: UUID) -> list | None:
    """Transcrição salva do Asset no formato da análise de cortes, ou ``None``.

    Só vale a gravada com palavras e tempos (Whisper local): trechos digitados ou antigos,
    sem marcação por palavra, não servem de evidência para os cortes.
    """
    from app.clips.contracts import TranscriptSegment, TranscriptWord

    rows = sorted(
        (row.data for row in asset_segments(session, tenant_id, asset_id)),
        key=lambda data: data.get("start_ms") or 0,
    )
    if not rows or not all(data.get("palavras") for data in rows):
        return None
    try:
        return [
            TranscriptSegment(
                start=data["start_ms"] / 1000,
                end=data["end_ms"] / 1000,
                text=data["texto"],
                words=[TranscriptWord(**word) for word in data["palavras"]],
            )
            for data in rows
        ]
    except (KeyError, TypeError, ValueError):
        return None


def is_running(data: dict[str, Any]) -> bool:
    if data.get("transcription_status") != "processing":
        return False
    started = datetime.fromisoformat(
        data.get("transcription_started_at") or "1970-01-01T00:00:00+00:00"
    )
    return datetime.now(UTC) - started < STALE_AFTER


async def transcribe_asset(
    session: Session, record: TenantRecord, *, force: bool = False
) -> dict[str, Any]:
    """Transcreve o Asset (já carregado e da empresa certa) e devolve ``{segments, reused}``."""
    tenant_id, asset_id = record.tenant_id, record.id
    if record.data.get("asset_type") not in TRANSCRIBABLE:
        raise PublicError(
            422, "TRANSCRIPTION_NOT_SUPPORTED", "Só áudio e vídeo podem ser transcritos."
        )
    existing = asset_segments(session, tenant_id, asset_id)
    if existing and not force:
        return {"segments": len(existing), "reused": True}
    if is_running(record.data):
        raise PublicError(409, "TRANSCRIPTION_RUNNING", "Esta mídia já está sendo transcrita.")
    source = LocalMediaStorage(get_settings().media_root).resolve(
        record.data.get("storage_key"), tenant_id=tenant_id
    )
    update_asset(
        record,
        transcription_status="processing",
        transcription_error=None,
        transcription_started_at=datetime.now(UTC).isoformat(),
    )
    session.commit()
    # Whisper na CPU leva minutos: não segurar conexão do pool enquanto transcreve.
    release_connection(session)
    try:
        segments = await run_in_threadpool(
            CommandTranscriptionAdapter.from_environment().transcribe, source
        )
    except (TranscriptionUnavailable, FileNotFoundError) as error:
        record = session.get(TenantRecord, asset_id)
        message = str(error) or "Falha na transcrição."
        update_asset(record, transcription_status="failed", transcription_error=message)
        session.commit()
        raise PublicError(503, "TRANSCRIPTION_UNAVAILABLE", message) from error

    record = session.get(TenantRecord, asset_id)
    session.execute(
        delete(TenantRecord).where(
            TenantRecord.id.in_([item.id for item in asset_segments(session, tenant_id, asset_id)])
        )
    )
    for segment in segments:
        session.add(
            TenantRecord(
                id=uuid4(),
                tenant_id=tenant_id,
                entity_type=SEGMENT_ENTITY,
                data={
                    "asset_id": str(asset_id),
                    "start_ms": round(segment.start * 1000),
                    "end_ms": round(segment.end * 1000),
                    "texto": segment.text,
                    "palavras": [word.model_dump() for word in segment.words],
                    "fonte": "whisper-local",
                },
            )
        )
    update_asset(
        record,
        transcription_status="done",
        transcription_error=None,
        transcription_segments=len(segments),
        ai_status="transcribed",
    )
    session.commit()
    return {"segments": len(segments), "reused": False}

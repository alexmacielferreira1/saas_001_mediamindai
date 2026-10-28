import base64
import json
import re
import shutil
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.v1.thumbnail_settings import configured_cutout
from app.core.config import get_settings
from app.core.errors import PublicError
from app.db.session import get_session, release_connection
from app.media import clip_render
from app.media.assets import serialize_asset
from app.media.exports import export_headers, record_export_copy, save_export
from app.media.storage import LocalMediaStorage
from app.media.transcripts import transcribe_asset
from app.models.identity import TenantRecord
from app.services.background_removal import remove_image_background
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/media", tags=["media"])
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
DbSession = Annotated[Session, Depends(get_session)]
MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024
ALLOWED_MEDIA = {
    ".aac": ("audio", {"audio/aac", "audio/x-aac"}),
    ".avi": ("video", {"video/x-msvideo"}),
    ".jpeg": ("image", {"image/jpeg"}),
    ".jpg": ("image", {"image/jpeg"}),
    ".m4a": ("audio", {"audio/mp4", "audio/x-m4a"}),
    ".mov": ("video", {"video/quicktime"}),
    ".mp3": ("audio", {"audio/mpeg"}),
    ".mp4": ("video", {"video/mp4", "application/mp4"}),
    ".ogg": ("audio", {"audio/ogg", "video/ogg"}),
    ".png": ("image", {"image/png"}),
    ".wav": ("audio", {"audio/wav", "audio/x-wav"}),
    ".webm": ("video", {"video/webm", "audio/webm"}),
    ".webp": ("image", {"image/webp"}),
}
LOCAL_DEMO_TENANT = UUID("00000000-0000-4000-8000-000000000001")
THUMBNAIL_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
THUMBNAIL_IMAGE_LIMIT = 20 * 1024 * 1024
# Exportações (MP4 gerado para download) ficam em ``<empresa>/exports/<uuid>`` e não têm
# registro: depois deste prazo são apagadas na próxima exportação da mesma empresa.
EXPORT_RETENTION_SECONDS = 24 * 60 * 60


def require_local_media() -> None:
    if get_settings().environment not in {"local", "test"}:
        raise PublicError(404, "NOT_FOUND", "Recurso não encontrado.")


async def read_thumbnail_image(file: UploadFile) -> bytes:
    if file.content_type not in THUMBNAIL_IMAGE_TYPES:
        raise PublicError(422, "IMAGE_REQUIRED", "Envie uma imagem PNG, JPG ou WebP.")
    content = await file.read(THUMBNAIL_IMAGE_LIMIT + 1)
    if not content:
        raise PublicError(422, "EMPTY_IMAGE", "A imagem enviada está vazia.")
    if len(content) > THUMBNAIL_IMAGE_LIMIT:
        raise PublicError(413, "FILE_TOO_LARGE", "A foto deve ter no máximo 20 MB.")
    return content


def local_catalog_path() -> Path:
    return get_settings().media_root / str(LOCAL_DEMO_TENANT) / "assets.json"


def load_local_catalog() -> list[dict]:
    path = local_catalog_path()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, list) else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_local_catalog(assets: list[dict]) -> None:
    path = local_catalog_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.part")
    temporary.write_text(json.dumps(assets, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


class ClipExportRequest(BaseModel):
    asset_id: UUID
    source_in: float = Field(default=0, ge=0)
    duration: float = Field(gt=0, le=24 * 60 * 60)
    properties: dict = Field(default_factory=dict)


class TimelineExportRequest(BaseModel):
    name: str = Field(default="MediaMind", max_length=180)
    tracks: list[dict] = Field(default_factory=list)
    in_point: float | None = Field(default=None, ge=0)
    out_point: float | None = Field(default=None, ge=0)


def trim_clip_to_export_range(
    clip: dict, in_point: float | None, out_point: float | None
) -> dict | None:
    """Return an export segment clipped to the sequence IN/OUT selection."""
    clip_start = max(0, float(clip.get("start", 0)))
    clip_duration = max(0, float(clip.get("duration", 0)))
    clip_end = clip_start + clip_duration
    range_start = max(0, float(in_point or 0))
    range_end = float(out_point) if out_point is not None else clip_end
    overlap_start = max(clip_start, range_start)
    overlap_end = min(clip_end, range_end)
    if overlap_end <= overlap_start:
        return None
    properties = clip.get("properties") or {}
    speed = max(0.25, min(4.0, float(properties.get("speed", 1) or 1)))
    return {
        "source_in": max(0, float(clip.get("sourceIn", 0)))
        + ((overlap_start - clip_start) * speed),
        "duration": max(1 / 30, (overlap_end - overlap_start) * speed),
        "timeline_start": overlap_start - range_start,
        "properties": properties,
    }


def find_ffmpeg() -> Path:
    configured = get_settings().ffmpeg_path
    candidates = [
        configured,
        Path(shutil.which("ffmpeg") or "") if shutil.which("ffmpeg") else None,
        get_settings().media_root.parents[1]
        / "work"
        / "ai-edita-analysis"
        / "ai-edita-studio-windows-x64"
        / "app"
        / "node_modules"
        / "@remotion"
        / "compositor-win32-x64-msvc"
        / "ffmpeg.exe",
    ]
    for candidate in candidates:
        if candidate and candidate.is_file():
            return candidate
    raise PublicError(503, "FFMPEG_UNAVAILABLE", "O motor local de exportação não está disponível.")


def probe_media(source: Path) -> dict:
    try:
        ffmpeg = find_ffmpeg()
        ffprobe = ffmpeg.with_name("ffprobe.exe" if ffmpeg.suffix else "ffprobe")
    except PublicError:
        return {}
    if not ffprobe.is_file():
        return {}
    try:
        result = subprocess.run(
            [
                str(ffprobe),
                "-v",
                "error",
                "-show_entries",
                "format=duration:stream=codec_type,width,height,r_frame_rate",
                "-of",
                "json",
                str(source),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (subprocess.TimeoutExpired, OSError):
        # Arquivo lento/corrompido ou ffprobe indisponível: o envio continua, sem duração.
        return {}
    if result.returncode:
        return {}
    try:
        payload = json.loads(result.stdout)
        video = next(
            (item for item in payload.get("streams", []) if item.get("codec_type") == "video"), {}
        )
        numerator, _, denominator = str(video.get("r_frame_rate") or "0/1").partition("/")
        fps = float(numerator) / max(1, float(denominator or 1))
        raw_duration = payload.get("format", {}).get("duration")
        if isinstance(raw_duration, (list, dict)):
            return {}
        return {
            "duration": round(float(raw_duration or 0), 3),
            **({"width": int(video["width"])} if video.get("width") else {}),
            **({"height": int(video["height"])} if video.get("height") else {}),
            **({"fps": round(fps, 3)} if fps else {}),
        }
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def prune_old_exports(exports_root: Path, *, max_age: float = EXPORT_RETENTION_SECONDS) -> None:
    """Apaga pastas de exportação antigas (o disco não cresce sem limite).

    Só pastas diretamente em ``exports/`` e mais velhas que ``max_age``: a exportação em
    andamento (recente) nunca é tocada. Falha ao apagar uma pasta em uso não interrompe.
    """
    if not exports_root.is_dir():
        return
    cutoff = time.time() - max_age
    for folder in exports_root.iterdir():
        if folder.is_symlink() or not folder.is_dir() or folder.stat().st_mtime > cutoff:
            continue
        try:
            LocalMediaStorage._remove_tree(folder)
        except OSError:
            continue


def render_media_clip(
    source: Path, destination: Path, *, source_in: float, duration: float, properties: dict
) -> None:
    # Validate optional ClipsFree instructions before touching FFmpeg or the disk.
    render_options = clip_render.parse_render_options(properties)
    speed = max(0.25, min(4.0, float(properties.get("speed", 1) or 1)))
    burn_subtitles = clip_render.needs_subtitles(render_options)
    video_filter = clip_render.build_video_filter(
        render_options, speed=speed, duration=duration, subtitles=burn_subtitles
    )
    audio_filter = clip_render.build_audio_filter(render_options, speed=speed, duration=duration)
    destination.parent.mkdir(parents=True, exist_ok=True)
    subtitle_file = (
        clip_render.write_subtitles(
            render_options, destination.parent, speed=speed, duration=duration
        )
        if burn_subtitles
        else None
    )
    command = [str(find_ffmpeg()), "-y", "-ss", str(source_in), "-t", str(duration)]
    if speed != 1:
        command.extend(["-itsscale", str(1 / speed)])
    command.extend(
        [
            "-i",
            str(source),
            "-map",
            "0:v:0",
            "-map",
            "0:a?",
            "-vf",
            video_filter,
            *(["-af", audio_filter] if audio_filter else []),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            str(destination),
        ]
    )
    # The subtitle filter reads a relative file name so no host path is embedded
    # in the filtergraph (Windows drive letters would need fragile escaping).
    run_options = {"cwd": str(destination.parent)} if subtitle_file else {}
    try:
        subprocess.run(command, check=True, capture_output=True, timeout=30 * 60, **run_options)
    except subprocess.TimeoutExpired as error:
        destination.unlink(missing_ok=True)
        raise PublicError(
            504, "EXPORT_TIMEOUT", "A exportação excedeu o tempo permitido."
        ) from error
    except subprocess.CalledProcessError as error:
        destination.unlink(missing_ok=True)
        raise PublicError(422, "EXPORT_FAILED", "Não foi possível exportar este clipe.") from error
    finally:
        if subtitle_file:
            subtitle_file.unlink(missing_ok=True)


def render_timeline_gap(destination: Path, *, duration: float) -> None:
    """Render a standards-matched black frame and silent audio timeline gap."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    safe_duration = max(1 / 30, float(duration))
    width, height = 1280, 720
    frame_source = destination.parent / "black.png"
    if not frame_source.exists():
        frame_source.write_bytes(
            base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
            )
        )
    command = [
        str(find_ffmpeg()),
        "-y",
        "-loop",
        "1",
        "-framerate",
        "30",
        "-i",
        str(frame_source),
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=48000:cl=stereo",
        "-t",
        str(safe_duration),
        "-shortest",
        "-vf",
        f"scale={width}:{height}",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-ac",
        "2",
        str(destination),
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, timeout=30 * 60)
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError) as error:
        destination.unlink(missing_ok=True)
        raise PublicError(
            422, "EXPORT_FAILED", "Não foi possível preservar uma lacuna da sequência."
        ) from error


def build_timeline_render_plan(segments: list[dict]) -> list[dict]:
    """Interleave media with black/silent gaps according to timeline positions."""
    plan: list[dict] = []
    cursor = 0.0
    for segment in sorted(segments, key=lambda item: float(item.get("timeline_start", 0))):
        start = max(0.0, float(segment.get("timeline_start", 0)))
        if start - cursor >= 1 / 30:
            plan.append({"kind": "gap", "duration": start - cursor})
        speed = max(0.25, min(4.0, float((segment.get("properties") or {}).get("speed", 1) or 1)))
        output_duration = max(1 / 30, float(segment["duration"]) / speed)
        plan.append({"kind": "media", **segment})
        cursor = max(cursor, start + output_duration)
    return plan


def render_timeline(segments: list[dict], destination: Path) -> None:
    if not segments:
        raise PublicError(
            422, "EMPTY_TIMELINE", "A trilha principal não possui clipes exportáveis."
        )
    segment_root = destination.parent / "segments"
    rendered = []
    for index, segment in enumerate(build_timeline_render_plan(segments)):
        output = segment_root / f"{index:04d}.mp4"
        if segment["kind"] == "gap":
            render_timeline_gap(output, duration=segment["duration"])
        else:
            render_media_clip(
                segment["source"],
                output,
                source_in=segment["source_in"],
                duration=segment["duration"],
                properties=segment["properties"],
            )
        rendered.append(output.resolve())
    concat_file = destination.parent / "concat.txt"
    concat_file.write_text(
        "".join(f"file '{path.as_posix()}'\n" for path in rendered), encoding="utf-8"
    )
    command = [
        str(find_ffmpeg()),
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_file),
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        str(destination),
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, timeout=30 * 60)
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError) as error:
        destination.unlink(missing_ok=True)
        raise PublicError(422, "EXPORT_FAILED", "Não foi possível exportar a sequência.") from error


def classify_upload(file: UploadFile) -> tuple[str, str]:
    suffix = Path(file.filename or "").suffix.lower()
    config = ALLOWED_MEDIA.get(suffix)
    if config is None or (file.content_type or "") not in config[1]:
        raise PublicError(422, "INVALID_MEDIA_TYPE", "Tipo de mídia não permitido.")
    return suffix, config[0]


@router.post("/local/thumbnails/remove-background")
async def remove_local_thumbnail_background(file: Annotated[UploadFile, File()]):
    require_local_media()
    content = await read_thumbnail_image(file)
    result = await run_in_threadpool(remove_image_background, content)
    return Response(content=result, media_type="image/png")


@router.post("/local/assets", status_code=201)
async def upload_local_asset(
    file: Annotated[UploadFile, File()],
    origin: Annotated[str | None, Form(max_length=64)] = None,
    project_id: Annotated[str | None, Form(max_length=180)] = None,
    recording_id: Annotated[str | None, Form(max_length=180)] = None,
):
    require_local_media()
    suffix, asset_type = classify_upload(file)
    asset_id = uuid4()
    storage = LocalMediaStorage(get_settings().media_root)
    stored = await storage.save_original(
        LOCAL_DEMO_TENANT, asset_id, file, get_settings().media_max_upload_bytes
    )
    now = datetime.now(UTC).isoformat()
    media_metadata = await run_in_threadpool(
        probe_media, storage.resolve(stored.relative_key, tenant_id=LOCAL_DEMO_TENANT)
    )
    asset = {
        "id": str(asset_id),
        "tenant_id": str(LOCAL_DEMO_TENANT),
        "filename": file.filename or f"media{suffix}",
        "title": Path(file.filename or "media").stem,
        "asset_type": asset_type,
        "mime_type": stored.mime_type,
        "file_size": stored.size,
        "sha256": stored.sha256,
        "storage_key": stored.relative_key,
        "media_status": "uploaded",
        **({"origin": origin} if origin else {}),
        **({"project_id": project_id} if project_id else {}),
        **({"recording_id": recording_id} if recording_id else {}),
        "stream_url": f"/api/v1/media/local/assets/{asset_id}/stream",
        "created_date": now,
        "updated_date": now,
        **media_metadata,
    }
    catalog = load_local_catalog()
    save_local_catalog([asset, *[item for item in catalog if item.get("id") != str(asset_id)]])
    return {key: value for key, value in asset.items() if key != "storage_key"}


@router.get("/local/assets")
def list_local_assets():
    require_local_media()
    return {
        "assets": [
            {key: value for key, value in asset.items() if key != "storage_key"}
            for asset in load_local_catalog()
        ]
    }


def find_local_asset(asset_id: UUID) -> dict:
    require_local_media()
    asset = next((item for item in load_local_catalog() if item.get("id") == str(asset_id)), None)
    if asset is None:
        raise PublicError(404, "MEDIA_NOT_FOUND", "Mídia não encontrada.")
    return asset


@router.get("/local/assets/{asset_id}/stream")
def stream_local_asset(asset_id: UUID, request: Request):
    asset = find_local_asset(asset_id)
    source = LocalMediaStorage(get_settings().media_root).resolve(
        asset["storage_key"], tenant_id=LOCAL_DEMO_TENANT
    )
    if not source.is_file():
        raise PublicError(404, "MEDIA_NOT_FOUND", "Mídia não encontrada.")
    size = source.stat().st_size
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=0"}
    range_value = request.headers.get("range")
    if not range_value:
        return FileResponse(source, media_type=asset.get("mime_type"), headers=headers)
    try:
        start, end = parse_byte_range(range_value, size)
    except (TypeError, ValueError):
        return Response(status_code=416, headers={**headers, "Content-Range": f"bytes */{size}"})
    return StreamingResponse(
        iter_file_range(source, start, end),
        status_code=206,
        media_type=asset.get("mime_type"),
        headers={
            **headers,
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(end - start + 1),
        },
    )


@router.post("/local/exports/clip")
def export_local_clip(payload: ClipExportRequest):
    asset = find_local_asset(payload.asset_id)
    if asset.get("asset_type") != "video":
        raise PublicError(422, "VIDEO_REQUIRED", "Selecione um clipe de vídeo para exportar.")
    storage = LocalMediaStorage(get_settings().media_root)
    destination = (
        get_settings().media_root / str(LOCAL_DEMO_TENANT) / "exports" / str(uuid4()) / "clip.mp4"
    )
    render_media_clip(
        storage.resolve(asset["storage_key"], tenant_id=LOCAL_DEMO_TENANT),
        destination,
        source_in=payload.source_in,
        duration=payload.duration,
        properties=payload.properties,
    )
    return FileResponse(
        destination,
        media_type="video/mp4",
        filename=f"{Path(asset['filename']).stem}-editado.mp4",
    )


@router.post("/local/exports/timeline")
def export_local_timeline(payload: TimelineExportRequest):
    require_local_media()
    main_track = next(
        (track for track in payload.tracks if track.get("id") == "v1"),
        next((track for track in payload.tracks if track.get("kind") == "video"), None),
    )
    catalog = {item["id"]: item for item in load_local_catalog()}
    storage = LocalMediaStorage(get_settings().media_root)
    segments = []
    for clip in sorted((main_track or {}).get("clips", []), key=lambda item: item.get("start", 0)):
        trimmed = trim_clip_to_export_range(clip, payload.in_point, payload.out_point)
        if not trimmed:
            continue
        asset = catalog.get(str(clip.get("assetId")))
        if not asset:
            continue
        segments.append(
            {
                "source": storage.resolve(asset["storage_key"], tenant_id=LOCAL_DEMO_TENANT),
                **trimmed,
            }
        )
    destination = (
        get_settings().media_root
        / str(LOCAL_DEMO_TENANT)
        / "exports"
        / str(uuid4())
        / "timeline.mp4"
    )
    render_timeline(segments, destination)
    safe_name = re.sub(r"[^\w.-]+", "-", payload.name, flags=re.UNICODE).strip("-.")
    return FileResponse(
        destination,
        media_type="video/mp4",
        filename=f"{safe_name or 'MediaMind'}-editado.mp4",
    )


@router.post("/assets", status_code=201)
async def upload_asset(
    current: Authenticated,
    session: DbSession,
    file: Annotated[UploadFile, File()],
    origin: Annotated[str | None, Form(max_length=64)] = None,
    project_id: Annotated[str | None, Form(max_length=180)] = None,
    recording_id: Annotated[str | None, Form(max_length=180)] = None,
):
    membership = require_membership(current)
    require_permission(session, current, "assets.write")
    suffix, asset_type = classify_upload(file)
    # O upload pode levar minutos (até 4 GB): não segurar conexão do pool enquanto grava.
    release_connection(session)
    asset_id = uuid4()
    storage = LocalMediaStorage(get_settings().media_root)
    stored = await storage.save_original(
        membership.tenant_id,
        asset_id,
        file,
        get_settings().media_max_upload_bytes,
    )
    try:
        # ffprobe é subprocesso bloqueante (até 30 s): fora do event loop.
        media_metadata = await run_in_threadpool(
            probe_media, storage.resolve(stored.relative_key, tenant_id=membership.tenant_id)
        )
    except Exception:
        # Sem registro, o arquivo gravado ficaria órfão no disco.
        storage.delete_asset(membership.tenant_id, asset_id)
        raise
    record = TenantRecord(
        id=asset_id,
        tenant_id=membership.tenant_id,
        entity_type="Asset",
        data={
            "filename": file.filename or f"media{suffix}",
            "title": Path(file.filename or "media").stem,
            "asset_type": asset_type,
            "mime_type": stored.mime_type,
            "file_size": stored.size,
            "sha256": stored.sha256,
            "storage_key": stored.relative_key,
            "media_status": "uploaded",
            **({"origin": origin} if origin else {}),
            **({"project_id": project_id} if project_id else {}),
            **({"recording_id": recording_id} if recording_id else {}),
            **media_metadata,
        },
    )
    if origin == "export":
        # Peça pronta renderizada no navegador (MMFilm): também vai para a pasta de destino.
        record_export_copy(
            record,
            current.tenant.slug,
            storage.resolve(stored.relative_key, tenant_id=membership.tenant_id),
        )
    session.add(record)
    try:
        session.commit()
    except Exception:
        session.rollback()
        storage.delete_asset(membership.tenant_id, asset_id)
        raise
    return serialize_asset(record)


@router.post("/thumbnails/remove-background")
async def remove_thumbnail_background(
    current: Authenticated,
    session: DbSession,
    file: Annotated[UploadFile, File()],
):
    require_membership(current)
    require_permission(session, current, "assets.write")
    content = await read_thumbnail_image(file)
    result = await configured_cutout(content, current, session)
    return Response(content=result, media_type="image/png")


@router.get("/assets")
def list_assets(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    records = list(
        session.scalars(
            select(TenantRecord)
            .where(
                TenantRecord.tenant_id == membership.tenant_id,
                TenantRecord.entity_type == "Asset",
            )
            .order_by(TenantRecord.created_at.desc())
        )
    )
    return {"assets": [serialize_asset(record) for record in records]}


def find_asset(session: Session, tenant_id: UUID, asset_id: UUID) -> TenantRecord:
    record = session.scalar(
        select(TenantRecord).where(
            TenantRecord.id == asset_id,
            TenantRecord.tenant_id == tenant_id,
            TenantRecord.entity_type == "Asset",
        )
    )
    if record is None:
        raise PublicError(404, "MEDIA_NOT_FOUND", "Mídia não encontrada.")
    return record


def parse_byte_range(value: str, size: int) -> tuple[int, int]:
    if not value.startswith("bytes=") or "," in value:
        raise ValueError
    start_text, separator, end_text = value.removeprefix("bytes=").partition("-")
    if not separator:
        raise ValueError
    if start_text:
        start = int(start_text)
        end = min(int(end_text), size - 1) if end_text else size - 1
    else:
        length = int(end_text)
        if length <= 0:
            raise ValueError
        start = max(0, size - length)
        end = size - 1
    if start < 0 or start >= size or end < start:
        raise ValueError
    return start, end


def iter_file_range(path: Path, start: int, end: int, chunk_size: int = 1024 * 1024):
    with path.open("rb") as source:
        source.seek(start)
        remaining = end - start + 1
        while remaining:
            chunk = source.read(min(chunk_size, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


class TranscriptionRequest(BaseModel):
    force: bool = False


@router.post("/assets/{asset_id}/transcription")
async def transcribe_media_asset(
    asset_id: UUID,
    current: Authenticated,
    session: DbSession,
    payload: TranscriptionRequest | None = None,
):
    """Transcreve a mídia com o Whisper local e grava os trechos (TranscricaoSegmento)."""
    membership = require_membership(current)
    require_permission(session, current, "assets.write")
    record = find_asset(session, membership.tenant_id, asset_id)
    return await transcribe_asset(session, record, force=bool(payload and payload.force))


@router.get("/assets/{asset_id}/stream")
def stream_asset(asset_id: UUID, request: Request, current: Authenticated, session: DbSession):
    membership = require_membership(current)
    record = find_asset(session, membership.tenant_id, asset_id)
    storage = LocalMediaStorage(get_settings().media_root)
    source = storage.resolve(record.data.get("storage_key"), tenant_id=membership.tenant_id)
    if not source.is_file():
        raise PublicError(404, "MEDIA_NOT_FOUND", "Mídia não encontrada.")
    size = source.stat().st_size
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=0"}
    range_value = request.headers.get("range")
    if not range_value:
        return FileResponse(
            source,
            media_type=record.data.get("mime_type") or "application/octet-stream",
            headers=headers,
        )
    try:
        start, end = parse_byte_range(range_value, size)
    except (TypeError, ValueError):
        return Response(status_code=416, headers={**headers, "Content-Range": f"bytes */{size}"})
    length = end - start + 1
    return StreamingResponse(
        iter_file_range(source, start, end),
        status_code=206,
        media_type=record.data.get("mime_type") or "application/octet-stream",
        headers={
            **headers,
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(length),
        },
    )


@router.post("/exports/clip")
def export_clip(payload: ClipExportRequest, current: Authenticated, session: DbSession):
    membership = require_membership(current)
    require_permission(session, current, "assets.write")
    record = find_asset(session, membership.tenant_id, payload.asset_id)
    if record.data.get("asset_type") != "video":
        raise PublicError(422, "VIDEO_REQUIRED", "Selecione um clipe de vídeo para exportar.")
    storage = LocalMediaStorage(get_settings().media_root)
    source = storage.resolve(record.data.get("storage_key"), tenant_id=membership.tenant_id)
    if not source.is_file():
        raise PublicError(404, "MEDIA_NOT_FOUND", "Mídia não encontrada.")
    export_id = uuid4()
    exports_root = get_settings().media_root / str(membership.tenant_id) / "exports"
    prune_old_exports(exports_root)
    destination = exports_root / str(export_id) / "clip.mp4"
    release_connection(session)
    render_media_clip(
        source,
        destination,
        source_in=payload.source_in,
        duration=payload.duration,
        properties=payload.properties,
    )
    filename = f"{Path(record.data['filename']).stem}-editado.mp4"
    saved, path = save_export(
        session,
        current,
        destination,
        filename=filename,
        kind="clip",
        source_asset_ids=[str(payload.asset_id)],
        probe=probe_media,
    )
    return FileResponse(
        path, media_type="video/mp4", filename=filename, headers=export_headers(saved)
    )


@router.post("/exports/timeline")
def export_timeline(payload: TimelineExportRequest, current: Authenticated, session: DbSession):
    membership = require_membership(current)
    require_permission(session, current, "assets.write")
    main_track = next(
        (track for track in payload.tracks if track.get("id") == "v1"),
        next((track for track in payload.tracks if track.get("kind") == "video"), None),
    )
    clips = sorted(
        (main_track or {}).get("clips", []), key=lambda clip: float(clip.get("start", 0))
    )
    storage = LocalMediaStorage(get_settings().media_root)
    segments = []
    for clip in clips:
        trimmed = trim_clip_to_export_range(clip, payload.in_point, payload.out_point)
        if not trimmed:
            continue
        try:
            asset_id = UUID(str(clip.get("assetId")))
        except (TypeError, ValueError):
            continue
        record = find_asset(session, membership.tenant_id, asset_id)
        segments.append(
            {
                "source": storage.resolve(
                    record.data.get("storage_key"), tenant_id=membership.tenant_id
                ),
                **trimmed,
            }
        )
    export_id = uuid4()
    exports_root = get_settings().media_root / str(membership.tenant_id) / "exports"
    prune_old_exports(exports_root)
    destination = exports_root / str(export_id) / "timeline.mp4"
    release_connection(session)
    render_timeline(segments, destination)
    safe_name = re.sub(r"[^\w.-]+", "-", payload.name, flags=re.UNICODE).strip("-.")
    filename = f"{safe_name or 'MediaMind'}-editado.mp4"
    saved, path = save_export(
        session,
        current,
        destination,
        filename=filename,
        kind="timeline",
        source_asset_ids=list(dict.fromkeys(str(clip.get("assetId")) for clip in clips)),
        probe=probe_media,
    )
    return FileResponse(
        path, media_type="video/mp4", filename=filename, headers=export_headers(saved)
    )

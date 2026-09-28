import json
import re
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import PublicError
from app.db.session import get_session
from app.media.assets import serialize_asset
from app.media.storage import LocalMediaStorage
from app.models.identity import TenantRecord
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


def require_local_media() -> None:
    if get_settings().environment == "production":
        raise PublicError(404, "NOT_FOUND", "Recurso não encontrado.")


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


def trim_clip_to_export_range(clip: dict, in_point: float | None, out_point: float | None) -> dict | None:
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
        "source_in": max(0, float(clip.get("sourceIn", 0))) + ((overlap_start - clip_start) * speed),
        "duration": max(1 / 30, (overlap_end - overlap_start) * speed),
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
    if result.returncode:
        return {}
    try:
        payload = json.loads(result.stdout)
        video = next(
            (item for item in payload.get("streams", []) if item.get("codec_type") == "video"), {}
        )
        numerator, _, denominator = str(video.get("r_frame_rate") or "0/1").partition("/")
        fps = float(numerator) / max(1, float(denominator or 1))
        return {
            "duration": round(float(payload.get("format", {}).get("duration") or 0), 3),
            **({"width": int(video["width"])} if video.get("width") else {}),
            **({"height": int(video["height"])} if video.get("height") else {}),
            **({"fps": round(fps, 3)} if fps else {}),
        }
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def render_media_clip(
    source: Path, destination: Path, *, source_in: float, duration: float, properties: dict
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    speed = max(0.25, min(4.0, float(properties.get("speed", 1) or 1)))
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
            "scale=1280:720",
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
    try:
        subprocess.run(command, check=True, capture_output=True, timeout=30 * 60)
    except subprocess.TimeoutExpired as error:
        destination.unlink(missing_ok=True)
        raise PublicError(
            504, "EXPORT_TIMEOUT", "A exportação excedeu o tempo permitido."
        ) from error
    except subprocess.CalledProcessError as error:
        destination.unlink(missing_ok=True)
        raise PublicError(422, "EXPORT_FAILED", "Não foi possível exportar este clipe.") from error


def render_timeline(segments: list[dict], destination: Path) -> None:
    if not segments:
        raise PublicError(
            422, "EMPTY_TIMELINE", "A trilha principal não possui clipes exportáveis."
        )
    segment_root = destination.parent / "segments"
    rendered = []
    for index, segment in enumerate(segments):
        output = segment_root / f"{index:04d}.mp4"
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


@router.post("/local/assets", status_code=201)
async def upload_local_asset(file: Annotated[UploadFile, File()]):
    require_local_media()
    suffix, asset_type = classify_upload(file)
    asset_id = uuid4()
    storage = LocalMediaStorage(get_settings().media_root)
    stored = await storage.save_original(
        LOCAL_DEMO_TENANT, asset_id, file, get_settings().media_max_upload_bytes
    )
    now = datetime.now(UTC).isoformat()
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
        "stream_url": f"/api/v1/media/local/assets/{asset_id}/stream",
        "created_date": now,
        "updated_date": now,
        **probe_media(storage.resolve(stored.relative_key)),
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
    source = LocalMediaStorage(get_settings().media_root).resolve(asset["storage_key"])
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
        storage.resolve(asset["storage_key"]),
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
                "source": storage.resolve(asset["storage_key"]),
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
):
    membership = require_membership(current)
    require_permission(session, current, "assets.write")
    suffix, asset_type = classify_upload(file)
    asset_id = uuid4()
    storage = LocalMediaStorage(get_settings().media_root)
    stored = await storage.save_original(
        membership.tenant_id,
        asset_id,
        file,
        get_settings().media_max_upload_bytes,
    )
    media_metadata = probe_media(storage.resolve(stored.relative_key))
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
            **media_metadata,
        },
    )
    session.add(record)
    try:
        session.commit()
    except Exception:
        session.rollback()
        storage.delete_asset(membership.tenant_id, asset_id)
        raise
    return serialize_asset(record)


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


@router.get("/assets/{asset_id}/stream")
def stream_asset(asset_id: UUID, request: Request, current: Authenticated, session: DbSession):
    membership = require_membership(current)
    record = find_asset(session, membership.tenant_id, asset_id)
    storage = LocalMediaStorage(get_settings().media_root)
    source = storage.resolve(record.data["storage_key"])
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
    source = storage.resolve(record.data["storage_key"])
    if not source.is_file():
        raise PublicError(404, "MEDIA_NOT_FOUND", "Mídia não encontrada.")
    export_id = uuid4()
    destination = (
        get_settings().media_root
        / str(membership.tenant_id)
        / "exports"
        / str(export_id)
        / "clip.mp4"
    )
    render_media_clip(
        source,
        destination,
        source_in=payload.source_in,
        duration=payload.duration,
        properties=payload.properties,
    )
    return FileResponse(
        destination,
        media_type="video/mp4",
        filename=f"{Path(record.data['filename']).stem}-editado.mp4",
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
                "source": storage.resolve(record.data["storage_key"]),
                **trimmed,
            }
        )
    export_id = uuid4()
    destination = (
        get_settings().media_root
        / str(membership.tenant_id)
        / "exports"
        / str(export_id)
        / "timeline.mp4"
    )
    render_timeline(segments, destination)
    safe_name = re.sub(r"[^\w.-]+", "-", payload.name, flags=re.UNICODE).strip("-.")
    return FileResponse(
        destination,
        media_type="video/mp4",
        filename=f"{safe_name or 'MediaMind'}-editado.mp4",
    )

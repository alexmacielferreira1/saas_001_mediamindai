"""Auditoria 2026-10-23, achados #6/#7: trabalho longo não pode segurar conexão do pool
nem travar o event loop.

- Antes de FFmpeg, transcrição/análise de cortes e chamadas HTTP de IA, a transação da
  requisição é encerrada (a conexão volta ao pool) e reaberta só para gravar o resultado.
- Em handlers ``async``, subprocessos e escrita em disco rodam fora do event loop.
"""

# ruff: noqa: F811

import asyncio
from pathlib import Path

import pytest
from app.clips.contracts import CandidateDimensions, TranscriptSegment, TranscriptWord
from app.clips.scoring import build_candidate
from app.core.config import get_settings
from app.db.session import get_session
from app.models.identity import TenantRecord
from cryptography.fernet import Fernet
from test_media_api import login, permission_client  # noqa: F401


@pytest.fixture
def tracked(permission_client, monkeypatch, tmp_path):
    """Registra as sessões de banco abertas pelas requisições."""
    client, ids = permission_client
    app = client.app
    original = app.dependency_overrides[get_session]
    sessions = []

    def tracking_session():
        source = original()
        session = next(source)
        sessions.append(session)
        try:
            yield session
        finally:
            source.close()

    app.dependency_overrides[get_session] = tracking_session
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    monkeypatch.setenv("AI_SECRET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    login(client)
    yield client, ids, sessions, tmp_path
    app.dependency_overrides[get_session] = original
    get_settings.cache_clear()


def open_transactions(sessions):
    return [session for session in sessions if session.in_transaction()]


def add_video_asset(ids, tmp_path):
    source = tmp_path / str(ids["tenant"]) / "asset" / "original" / "source.mp4"
    source.parent.mkdir(parents=True, exist_ok=True)
    source.write_bytes(b"video")
    with ids["session_factory"]() as session:
        asset = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="Asset",
            data={
                "filename": "entrevista.mp4",
                "asset_type": "video",
                "storage_key": source.relative_to(tmp_path).as_posix(),
            },
        )
        session.add(asset)
        session.commit()
        return asset.id


def test_clip_export_releases_db_connection_during_ffmpeg(tracked, monkeypatch):
    client, ids, sessions, tmp_path = tracked
    asset_id = add_video_asset(ids, tmp_path)
    seen = []

    def fake_render(_source, destination, **_kwargs):
        seen.append(len(open_transactions(sessions)))
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"mp4")

    monkeypatch.setattr("app.api.v1.media.render_media_clip", fake_render)
    response = client.post(
        "/api/v1/media/exports/clip", json={"asset_id": str(asset_id), "duration": 1}
    )

    assert response.status_code == 200
    assert seen == [0]


def test_timeline_export_releases_db_connection_during_ffmpeg(tracked, monkeypatch):
    client, ids, sessions, tmp_path = tracked
    asset_id = add_video_asset(ids, tmp_path)
    seen = []

    def fake_render(_segments, destination):
        seen.append(len(open_transactions(sessions)))
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"mp4")

    monkeypatch.setattr("app.api.v1.media.render_timeline", fake_render)
    response = client.post(
        "/api/v1/media/exports/timeline",
        json={"tracks": [{"id": "v1", "clips": [{"assetId": str(asset_id), "duration": 1}]}]},
    )

    assert response.status_code == 200
    assert seen == [0]


def grounded_candidate():
    words = [TranscriptWord(text="Fala", start=1, end=1.2)]
    segment = TranscriptSegment(start=0, end=30, text="Fala", words=words)
    candidate = build_candidate(
        start=0,
        end=25,
        evidence=words,
        dimensions=CandidateDimensions(hook=20, flow=20, value=20, shareability=20),
    )
    return segment, candidate


@pytest.mark.parametrize(
    ("module", "path", "payload", "expected_status"),
    [
        ("clips", "/api/v1/clips/analyses", {}, 202),
        (
            "clipsfree2",
            "/api/v1/clipsfree2/sessions",
            {"format": "9:16", "caption_style": "x"},
            201,
        ),
    ],
)
def test_clip_analysis_releases_db_connection_during_transcription(
    tracked, monkeypatch, module, path, payload, expected_status
):
    client, ids, sessions, tmp_path = tracked
    asset_id = add_video_asset(ids, tmp_path)
    segment, candidate = grounded_candidate()
    seen = []

    def transcribe(_self, _path):
        seen.append(len(open_transactions(sessions)))
        return [segment]

    def suggest(_self, _segments):
        seen.append(len(open_transactions(sessions)))
        return [candidate]

    monkeypatch.setattr(
        f"app.api.v1.{module}.CommandTranscriptionAdapter.from_environment",
        lambda: type("A", (), {"transcribe": transcribe})(),
    )
    monkeypatch.setattr(
        f"app.api.v1.{module}.CommandAnalysisAdapter.from_environment",
        lambda: type("A", (), {"suggest": suggest})(),
    )

    response = client.post(path, json={"asset_id": str(asset_id), **payload})

    assert response.status_code == expected_status, response.text
    assert response.json()["status"] == "completed"
    assert seen == [0, 0]


def test_clip_analysis_failure_after_release_is_recorded_as_failed(tracked, monkeypatch):
    client, ids, _sessions, tmp_path = tracked
    asset_id = add_video_asset(ids, tmp_path)

    def explode(_self, _path):
        raise RuntimeError("falha inesperada do motor")

    monkeypatch.setattr(
        "app.api.v1.clips.CommandTranscriptionAdapter.from_environment",
        lambda: type("A", (), {"transcribe": explode})(),
    )

    response = client.post("/api/v1/clips/analyses", json={"asset_id": str(asset_id)})

    assert response.status_code == 500
    with ids["session_factory"]() as session:
        analyses = session.query(TenantRecord).filter_by(entity_type="ClipAnalysis").all()
    assert [item.data["status"] for item in analyses] == ["failed"]


def save_connection(client):
    saved = client.put(
        "/api/v1/ai/connections",
        json={
            "connections": [
                {
                    "id": "main",
                    "name": "IA",
                    "base_url": "https://provider.example.test/v1",
                    "model": "gpt-image-1",
                    "api_key": "chave",
                }
            ],
            "default_connection_id": "main",
        },
    )
    assert saved.status_code == 200


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/api/v1/ai/copilot/chat", {"message": "Oi"}),
        ("/api/v1/ai/generation/image", {"prompt": "Teste"}),
        ("/api/v1/ai/generation/video-studio", {"stage": "roteiro", "prompt": "Ideia"}),
        ("/api/v1/mcp/tools/ai-tools.prompt/call", {"arguments": {"prompt": "Oi"}}),
    ],
)
def test_ai_calls_release_db_connection_during_provider_request(
    tracked, monkeypatch, path, payload
):
    client, _ids, sessions, _tmp_path = tracked
    save_connection(client)
    seen = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [{"message": {"content": "Resposta"}, "finish_reason": "stop"}],
                "data": [{"b64_json": "aW1n"}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1},
            }

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, _url, **_kwargs):
            seen.append(len(open_transactions(sessions)))
            return FakeResponse()

    monkeypatch.setattr("app.api.v1.ai.httpx.AsyncClient", FakeClient)

    response = client.post(path, json=payload)

    assert response.status_code == 200, response.text
    assert seen == [0]
    usage = client.get("/api/v1/records/LogAuditoria")
    assert usage.status_code == 200


def on_event_loop() -> bool:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return False
    return True


def test_media_upload_probes_and_writes_off_the_event_loop(tracked, monkeypatch):
    client, _ids, sessions, _tmp_path = tracked
    probed = []
    writes = []

    def fake_probe(_path):
        probed.append((on_event_loop(), len(open_transactions(sessions))))
        return {}

    original_open = Path.open

    class CheckedFile:
        def __init__(self, handle):
            self.handle = handle

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return self.handle.__exit__(*args)

        def write(self, chunk):
            writes.append(on_event_loop())
            return self.handle.write(chunk)

    def checked_open(self, mode="r", *args, **kwargs):
        handle = original_open(self, mode, *args, **kwargs)
        return CheckedFile(handle) if self.name.endswith(".part") and "w" in mode else handle

    monkeypatch.setattr(Path, "open", checked_open)

    monkeypatch.setattr("app.api.v1.media.probe_media", fake_probe)
    response = client.post(
        "/api/v1/media/assets",
        files={"file": ("reportagem.mp4", b"real-video-bytes", "video/mp4")},
    )

    assert response.status_code == 201
    assert probed == [(False, 0)]
    assert writes and not any(writes)


def test_creative_export_is_stored_off_the_event_loop(tracked, monkeypatch):
    client, _ids, sessions, tmp_path = tracked
    from app.creative.storage import store_creative_export

    monkeypatch.setattr("app.api.v1.creative_tools.CREATIVE_EXPORT_ROOT", tmp_path / "exports")
    calls = []

    def checked_store(*args, **kwargs):
        calls.append((on_event_loop(), len(open_transactions(sessions))))
        return store_creative_export(*args, **kwargs)

    monkeypatch.setattr("app.api.v1.creative_tools.store_creative_export", checked_store)
    from test_creative_tools_api import create_document

    created = create_document(client)
    exported = client.post(
        f"/api/v1/creative-documents/{created['id']}/exports",
        data={"revision": "1", "preset": "4:5"},
        files={"file": ("carrossel.zip", b"PK\x03\x04conteudo", "application/zip")},
    )

    assert exported.status_code == 201, exported.text
    assert calls == [(False, 0)]

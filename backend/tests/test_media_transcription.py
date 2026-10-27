# ruff: noqa: F811

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from app.clips import transcription as transcription_module
from app.clips.contracts import TranscriptSegment, TranscriptWord
from app.clips.transcription import CommandTranscriptionAdapter, TranscriptionUnavailable
from app.core.config import get_settings
from app.models.identity import TenantRecord
from sqlalchemy import select
from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def speech(*parts):
    return [
        TranscriptSegment(
            start=start, end=end, text=text, words=[TranscriptWord(text=text, start=start, end=end)]
        )
        for start, end, text in parts
    ]


class FakeTranscriber:
    calls: list = []
    result: list | Exception = []

    def transcribe(self, source):
        FakeTranscriber.calls.append(source)
        if isinstance(FakeTranscriber.result, Exception):
            raise FakeTranscriber.result
        return FakeTranscriber.result


@pytest.fixture
def media(monkeypatch, tmp_path):
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path / "destino"))
    monkeypatch.setenv("INGEST_SOURCE_ROOT", str(tmp_path / "entrada"))
    monkeypatch.setattr("app.api.v1.media.probe_media", lambda _path: {})
    monkeypatch.setattr("app.api.v1.ingest.probe_media", lambda _path: {})
    monkeypatch.setattr(
        "app.media.transcripts.CommandTranscriptionAdapter.from_environment",
        lambda: FakeTranscriber(),
    )
    FakeTranscriber.calls = []
    FakeTranscriber.result = speech((0.0, 1.5, "Bom dia."), (1.5, 3.25, "Começa o jornal."))
    get_settings.cache_clear()
    yield tmp_path
    get_settings.cache_clear()


def upload(client, name="sonora.wav", content=b"audio-real", mime="audio/wav"):
    response = client.post("/api/v1/media/assets", files={"file": (name, content, mime)})
    assert response.status_code == 201
    return response.json()["id"]


def segments_of(ids, asset_id):
    with ids["session_factory"]() as session:
        rows = session.scalars(
            select(TenantRecord).where(TenantRecord.entity_type == "TranscricaoSegmento")
        ).all()
        return sorted(
            (row.data for row in rows if row.data["asset_id"] == asset_id),
            key=lambda item: item["start_ms"],
        )


def asset_data(ids, asset_id):
    with ids["session_factory"]() as session:
        return session.get(TenantRecord, UUID(asset_id)).data


def test_transcribes_asset_and_saves_segments_the_screens_read(permission_client, media):
    client, ids = permission_client
    login(client)
    asset_id = upload(client)

    response = client.post(f"/api/v1/media/assets/{asset_id}/transcription")

    assert response.status_code == 200
    assert response.json() == {"segments": 2, "reused": False}
    saved = segments_of(ids, asset_id)
    assert [(item["start_ms"], item["end_ms"], item["texto"]) for item in saved] == [
        (0, 1500, "Bom dia."),
        (1500, 3250, "Começa o jornal."),
    ]
    assert saved[0]["palavras"] == [{"text": "Bom dia.", "start": 0.0, "end": 1.5}]
    data = asset_data(ids, asset_id)
    assert data["transcription_status"] == "done"
    assert data["transcription_segments"] == 2
    assert data["ai_status"] == "transcribed"
    # Visível pela API genérica que Workspace/Pesquisa usam.
    listed = client.get(
        "/api/v1/records/TranscricaoSegmento", params={"q": f'{{"asset_id":"{asset_id}"}}'}
    )
    assert listed.status_code == 200
    assert FakeTranscriber.calls[0].name == "source.wav"

    # Segunda chamada reaproveita; "force" refaz e substitui (sem duplicar trechos).
    assert client.post(f"/api/v1/media/assets/{asset_id}/transcription").json() == {
        "segments": 2,
        "reused": True,
    }
    FakeTranscriber.result = speech((0.0, 2.0, "Versão nova."))
    redone = client.post(f"/api/v1/media/assets/{asset_id}/transcription", json={"force": True})
    assert redone.json() == {"segments": 1, "reused": False}
    assert [item["texto"] for item in segments_of(ids, asset_id)] == ["Versão nova."]


def test_failure_is_explained_and_recorded_on_the_asset(permission_client, media):
    client, ids = permission_client
    login(client)
    asset_id = upload(client)
    FakeTranscriber.result = TranscriptionUnavailable("Nenhum transcritor foi configurado.")

    response = client.post(f"/api/v1/media/assets/{asset_id}/transcription")

    assert response.status_code == 503
    assert response.json()["error_code"] == "TRANSCRIPTION_UNAVAILABLE"
    assert response.json()["message"] == "Nenhum transcritor foi configurado."
    data = asset_data(ids, asset_id)
    assert data["transcription_status"] == "failed"
    assert data["transcription_error"] == "Nenhum transcritor foi configurado."
    assert segments_of(ids, asset_id) == []


def test_refuses_images_running_jobs_viewers_and_other_companies(permission_client, media):
    client, ids = permission_client
    login(client)
    image_id = upload(client, "foto.png", b"png", "image/png")
    response = client.post(f"/api/v1/media/assets/{image_id}/transcription")
    assert response.json()["error_code"] == "TRANSCRIPTION_NOT_SUPPORTED"

    asset_id = upload(client)
    with ids["session_factory"]() as session:
        record = session.get(TenantRecord, UUID(asset_id))
        record.data = {
            **record.data,
            "transcription_status": "processing",
            "transcription_started_at": datetime.now(UTC).isoformat(),
        }
        session.commit()
    assert client.post(f"/api/v1/media/assets/{asset_id}/transcription").status_code == 409

    with ids["session_factory"]() as session:
        other = TenantRecord(
            id=uuid4(),
            tenant_id=ids["other"],
            entity_type="Asset",
            data={"asset_type": "audio", "storage_key": "x/y/original/source.wav"},
        )
        session.add(other)
        session.commit()
        other_id = other.id
    assert client.post(f"/api/v1/media/assets/{other_id}/transcription").status_code == 404

    login(client, "viewer@mediamind.ai")
    assert client.post(f"/api/v1/media/assets/{asset_id}/transcription").status_code == 403
    assert FakeTranscriber.calls == []


def test_interrupted_transcription_can_run_again(permission_client, media):
    client, ids = permission_client
    login(client)
    asset_id = upload(client)
    with ids["session_factory"]() as session:
        record = session.get(TenantRecord, UUID(asset_id))
        record.data = {
            **record.data,
            "transcription_status": "processing",
            "transcription_started_at": "2026-01-01T00:00:00+00:00",
        }
        session.commit()

    assert client.post(f"/api/v1/media/assets/{asset_id}/transcription").status_code == 200


def test_ingest_package_transcribes_imported_audio_and_video(permission_client, media):
    client, ids = permission_client
    login(client)
    company = media / "entrada" / "empresa"
    company.mkdir(parents=True)
    (company / "sonora.wav").write_bytes(b"audio-sonora")
    (company / "foto.png").write_bytes(b"png")
    (company / "sumiu.mp4").write_bytes(b"video-sumiu")
    package = client.post(
        "/api/v1/ingest/packages",
        json={"name": "Lote", "files": ["sonora.wav", "foto.png", "sumiu.mp4"]},
    ).json()
    for _ in range(3):
        package = client.post(f"/api/v1/ingest/packages/{package['id']}/import-next").json()
    assert package["status"] == "completed"
    assert package["transcription_pending"] == 2

    # A mídia do vídeo foi apagada do acervo antes da transcrição.
    video_id = package["items"][2]["asset_id"]
    assert client.delete(f"/api/v1/records/Asset/{video_id}").status_code == 204

    first = client.post(f"/api/v1/ingest/packages/{package['id']}/transcribe-next").json()
    assert first["items"][0]["transcription"] == "done"
    assert first["items"][0]["transcription_segments"] == 2
    assert first["transcription_pending"] == 1
    second = client.post(f"/api/v1/ingest/packages/{package['id']}/transcribe-next").json()
    assert second["items"][2]["transcription"] == "failed"
    assert second["items"][2]["transcription_error"] == "A mídia foi removida do acervo."
    assert "transcription" not in second["items"][1]
    finished = client.post(f"/api/v1/ingest/packages/{package['id']}/transcribe-next").json()
    assert finished["items"] == second["items"]
    assert len(segments_of(ids, package["items"][0]["asset_id"])) == 2


def test_ingest_records_transcriber_errors_per_file(permission_client, media):
    client, _ = permission_client
    login(client)
    company = media / "entrada" / "empresa"
    company.mkdir(parents=True)
    (company / "sonora.wav").write_bytes(b"audio-sonora")
    package = client.post(
        "/api/v1/ingest/packages", json={"name": "Lote", "files": ["sonora.wav"]}
    ).json()
    client.post(f"/api/v1/ingest/packages/{package['id']}/import-next")
    FakeTranscriber.result = TranscriptionUnavailable(
        "O transcritor não conseguiu processar a mídia."
    )

    done = client.post(f"/api/v1/ingest/packages/{package['id']}/transcribe-next").json()

    assert done["items"][0]["transcription"] == "failed"
    assert (
        done["items"][0]["transcription_error"] == "O transcritor não conseguiu processar a mídia."
    )
    assert done["transcription_pending"] == 0


def test_ingest_without_ai_does_not_transcribe(permission_client, media):
    client, _ = permission_client
    login(client)
    company = media / "entrada" / "empresa"
    company.mkdir(parents=True)
    (company / "sonora.wav").write_bytes(b"audio-sonora")
    package = client.post(
        "/api/v1/ingest/packages",
        json={"name": "Lote", "files": ["sonora.wav"], "ai_enabled": False},
    ).json()
    package = client.post(f"/api/v1/ingest/packages/{package['id']}/import-next").json()

    assert package["transcription_pending"] == 0
    client.post(f"/api/v1/ingest/packages/{package['id']}/transcribe-next")
    assert FakeTranscriber.calls == []


def test_local_whisper_is_the_default_when_installed(monkeypatch):
    class Settings:
        clips_transcriber_command = None

    monkeypatch.delenv("CLIPS_TRANSCRIBER_COMMAND", raising=False)
    monkeypatch.setattr(transcription_module, "get_settings", lambda: Settings)
    command = CommandTranscriptionAdapter.from_environment().command_template
    assert command.endswith('scripts/transcribe_local.py" {input} {output}')

    monkeypatch.setattr(transcription_module.importlib.util, "find_spec", lambda _name: None)
    assert CommandTranscriptionAdapter.from_environment().command_template == ""

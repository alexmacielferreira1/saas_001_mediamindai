# ruff: noqa: F811

from app.clips.contracts import CandidateDimensions, TranscriptSegment, TranscriptWord
from app.clips.scoring import build_candidate
from app.clips.service import ClipAnalysisService
from app.models.identity import TenantRecord
from test_media_api import login, permission_client  # noqa: F401


def _asset(ids, tenant_key="tenant", storage_key="missing/source.mp4"):
    with ids["session_factory"]() as session:
        asset = TenantRecord(
            tenant_id=ids[tenant_key],
            entity_type="Asset",
            data={"filename": "entrevista.mp4", "storage_key": storage_key},
        )
        session.add(asset)
        session.commit()
        return asset.id


def _real_source(ids, tmp_path, monkeypatch):
    source = tmp_path / str(ids["tenant"]) / "source.mp4"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"video")
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    return _asset(ids, storage_key=source.relative_to(tmp_path).as_posix())


def _candidate():
    words = [
        TranscriptWord(text="Fala", start=1, end=1.2),
        TranscriptWord(text="real", start=1.2, end=1.5),
    ]
    segment = TranscriptSegment(start=0, end=30, text="Fala real", words=words)
    candidate = build_candidate(
        start=0,
        end=25,
        evidence=words,
        dimensions=CandidateDimensions(hook=20, flow=20, value=20, shareability=20),
    )
    return segment, candidate


def test_analysis_rejects_minimum_longer_than_maximum(permission_client):
    client, ids = permission_client
    login(client)
    asset_id = _asset(ids)

    response = client.post(
        "/api/v1/clips/analyses",
        json={"asset_id": str(asset_id), "minimum": 50, "maximum": 20},
    )

    assert response.status_code == 422


def test_analysis_of_other_tenant_asset_is_not_found(permission_client):
    client, ids = permission_client
    login(client)
    foreign_asset = _asset(ids, tenant_key="other")

    response = client.post("/api/v1/clips/analyses", json={"asset_id": str(foreign_asset)})

    assert response.status_code == 404
    assert response.json()["error_code"] == "ASSET_NOT_FOUND"


def test_analysis_with_remote_connection_uses_remote_adapters_and_reads_back(
    permission_client, monkeypatch, tmp_path
):
    client, ids = permission_client
    login(client)
    asset_id = _real_source(ids, tmp_path, monkeypatch)
    with ids["session_factory"]() as session:
        session.add(
            TenantRecord(
                tenant_id=ids["tenant"],
                entity_type="AISettings",
                data={
                    "connections": [
                        {
                            "id": "remota",
                            "provider": "compatible",
                            "base_url": "https://api.example.test/v1",
                            "model": "gpt-4o",
                            "enabled": True,
                            "encrypted_key": "cifrada",
                        }
                    ]
                },
            )
        )
        session.commit()
    segment, candidate = _candidate()
    too_short = build_candidate(
        start=0,
        end=16,
        evidence=segment.words,
        dimensions=CandidateDimensions(hook=20, flow=20, value=20, shareability=20),
    )
    received = {}

    class FakeTranscription:
        def __init__(self, connection, api_key):
            received["transcription"] = (connection["id"], api_key)

        def transcribe(self, _path):
            return [segment]

    class FakeAnalysis:
        def __init__(self, connection, api_key):
            received["analysis"] = (connection["id"], api_key)

        def suggest(self, _segments, **kwargs):
            received["kwargs"] = kwargs
            return [candidate, too_short]

    monkeypatch.setattr("app.api.v1.clips.decrypt_ai_key", lambda _connection: "chave-real")
    monkeypatch.setattr("app.api.v1.clips.RemoteTranscriptionAdapter", FakeTranscription)
    monkeypatch.setattr("app.api.v1.clips.RemoteAnalysisAdapter", FakeAnalysis)

    response = client.post(
        "/api/v1/clips/analyses",
        json={"asset_id": str(asset_id), "connection_id": "remota", "editorial_prompt": "humor"},
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["status"] == "completed"
    assert len(payload["candidates"]) == 1
    assert "chave-real" not in response.text
    assert received["transcription"] == ("remota", "chave-real")
    assert received["kwargs"] == {"minimum": 20, "maximum": 60, "editorial_prompt": "humor"}

    read_back = client.get(f"/api/v1/clips/analyses/{payload['id']}")
    assert read_back.status_code == 200
    assert read_back.json()["id"] == payload["id"]


def test_unexpected_failure_marks_analysis_failed_instead_of_queued(
    permission_client, monkeypatch, tmp_path
):
    client, ids = permission_client
    login(client)
    asset_id = _real_source(ids, tmp_path, monkeypatch)

    def broken():
        raise RuntimeError("falha interna com /caminho/secreto")

    monkeypatch.setattr("app.api.v1.clips.CommandTranscriptionAdapter.from_environment", broken)

    response = client.post("/api/v1/clips/analyses", json={"asset_id": str(asset_id)})

    assert response.status_code == 500
    assert "secreto" not in response.text
    with ids["session_factory"]() as session:
        analyses = [
            record
            for record in session.query(TenantRecord).all()
            if record.entity_type == "ClipAnalysis"
        ]
        assert [record.data["status"] for record in analyses] == ["failed"]


def test_failure_while_recording_failed_state_is_rolled_back_and_reraised(
    permission_client, monkeypatch, tmp_path
):
    client, ids = permission_client
    login(client)
    asset_id = _real_source(ids, tmp_path, monkeypatch)

    def broken():
        raise RuntimeError("falha interna")

    def broken_state(*_args, **_kwargs):
        raise RuntimeError("banco indisponível")

    monkeypatch.setattr("app.api.v1.clips.CommandTranscriptionAdapter.from_environment", broken)
    monkeypatch.setattr(ClipAnalysisService, "set_state", broken_state)

    response = client.post("/api/v1/clips/analyses", json={"asset_id": str(asset_id)})

    assert response.status_code == 500
    assert "banco" not in response.text

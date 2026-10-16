# ruff: noqa: F811

from uuid import uuid4

from app.clips.contracts import CandidateDimensions, TranscriptSegment, TranscriptWord
from app.clips.scoring import build_candidate
from app.models.identity import TenantRecord
from test_media_api import login, permission_client  # noqa: F401


def test_starting_analysis_returns_an_honest_unavailable_state_without_a_provider(
    permission_client, monkeypatch, tmp_path
):
    client, ids = permission_client
    login(client)
    with ids["session_factory"]() as session:
        asset = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="Asset",
            data={"filename": "entrevista.mp4", "storage_key": "missing/source.mp4"},
        )
        session.add(asset)
        session.commit()
        asset_id = asset.id

    response = client.post("/api/v1/clips/analyses", json={"asset_id": str(asset_id)})

    assert response.status_code == 202
    assert response.json()["status"] == "unavailable"
    assert response.json()["candidates"] == []
    assert "transcrição" in response.json()["message"].lower()


def test_clip_analysis_is_not_visible_to_other_tenant(permission_client):
    client, _ids = permission_client
    login(client)

    response = client.get(f"/api/v1/clips/analyses/{uuid4()}")

    assert response.status_code == 404
    assert response.json()["error_code"] == "CLIP_ANALYSIS_NOT_FOUND"


def test_selected_ai_connection_is_saved_on_the_analysis_job(permission_client):
    client, ids = permission_client
    login(client)
    with ids["session_factory"]() as session:
        asset = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="Asset",
            data={"filename": "entrevista.mp4", "storage_key": "missing/source.mp4"},
        )
        settings = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="AISettings",
            data={
                "connections": [
                    {
                        "id": "creditos-video",
                        "name": "IA com créditos",
                        "provider": "compatible",
                        "base_url": "https://api.example.test/v1",
                        "model": "gpt-4o",
                        "enabled": True,
                        "encrypted_key": "stored-without-exposure",
                    }
                ]
            },
        )
        session.add_all([asset, settings])
        session.commit()
        asset_id = asset.id

    response = client.post(
        "/api/v1/clips/analyses",
        json={"asset_id": str(asset_id), "connection_id": "creditos-video"},
    )

    assert response.status_code == 202
    assert response.json()["connection_id"] == "creditos-video"


def test_analysis_uses_the_admin_assigned_auto_clips_connection(permission_client):
    client, ids = permission_client
    login(client)
    with ids["session_factory"]() as session:
        asset = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="Asset",
            data={"filename": "entrevista.mp4", "storage_key": "missing/source.mp4"},
        )
        settings = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="AISettings",
            data={
                "connections": [
                    {
                        "id": "auto-clips-admin",
                        "name": "IA definida pela administração",
                        "provider": "compatible",
                        "base_url": "https://api.example.test/v1",
                        "model": "gpt-4o",
                        "enabled": True,
                        "encrypted_key": "stored-without-exposure",
                    }
                ],
                "tool_connections": {"auto-clips": "auto-clips-admin"},
            },
        )
        session.add_all([asset, settings])
        session.commit()
        asset_id = asset.id

    response = client.post(
        "/api/v1/clips/analyses",
        json={"asset_id": str(asset_id), "connection_id": "tentativa-de-sobrescrever"},
    )

    assert response.status_code == 202
    assert response.json()["connection_id"] == "auto-clips-admin"


def test_unknown_ai_connection_is_rejected_before_creating_an_analysis(permission_client):
    client, ids = permission_client
    login(client)
    with ids["session_factory"]() as session:
        asset = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="Asset",
            data={"filename": "entrevista.mp4", "storage_key": "missing/source.mp4"},
        )
        session.add(asset)
        session.commit()
        asset_id = asset.id

    response = client.post(
        "/api/v1/clips/analyses",
        json={"asset_id": str(asset_id), "connection_id": "inexistente"},
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "CLIP_AI_CONNECTION_INVALID"


def test_starting_analysis_returns_only_transcript_grounded_candidates(
    permission_client, monkeypatch, tmp_path
):
    client, ids = permission_client
    login(client)
    source = tmp_path / str(ids["tenant"]) / "source.mp4"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"video")
    with ids["session_factory"]() as session:
        asset = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="Asset",
            data={
                "filename": "entrevista.mp4",
                "storage_key": source.relative_to(tmp_path).as_posix(),
            },
        )
        session.add(asset)
        session.commit()
        asset_id = asset.id

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
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    monkeypatch.setattr(
        "app.api.v1.clips.CommandTranscriptionAdapter.from_environment",
        lambda: type("A", (), {"transcribe": lambda _self, _path: [segment]})(),
    )
    monkeypatch.setattr(
        "app.api.v1.clips.CommandAnalysisAdapter.from_environment",
        lambda: type("A", (), {"suggest": lambda _self, _segments: [candidate]})(),
    )

    response = client.post("/api/v1/clips/analyses", json={"asset_id": str(asset_id)})

    assert response.status_code == 202
    assert response.json()["status"] == "completed"
    assert response.json()["candidates"][0]["quote"] == "Fala real"
    assert response.json()["candidates"][0]["captions"][0]["text"] == "Fala real"

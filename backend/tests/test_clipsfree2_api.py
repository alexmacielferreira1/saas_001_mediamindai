# ruff: noqa: F811

from app.models.identity import TenantRecord
from app.clips.contracts import CandidateDimensions, TranscriptSegment, TranscriptWord
from app.clips.scoring import build_candidate
from test_media_api import login, permission_client  # noqa: F401


def test_clipsfree2_creates_an_isolated_manual_review_session(permission_client):
    client, ids = permission_client
    login(client)
    with ids["session_factory"]() as session:
        asset = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="Asset",
            data={"filename": "entrevista.mp4", "storage_key": "source.mp4"},
        )
        session.add(asset)
        session.commit()
        asset_id = asset.id

    response = client.post(
        "/api/v1/clipsfree2/sessions",
        json={"asset_id": str(asset_id), "format": "9:16", "caption_style": "destaque"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "manual_review"
    assert payload["asset_id"] == str(asset_id)
    assert payload["format"] == "9:16"
    assert payload["candidates"] == []
    assert "manual" in payload["message"].lower()


def test_clipsfree2_returns_candidates_grounded_in_its_own_transcription(
    permission_client, monkeypatch, tmp_path
):
    client, ids = permission_client
    login(client)
    source = tmp_path / str(ids["tenant"]) / "entrevista.mp4"
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
        TranscriptWord(text="Ideia", start=1, end=1.2),
        TranscriptWord(text="real", start=1.2, end=1.5),
    ]
    candidate = build_candidate(
        start=0,
        end=25,
        evidence=words,
        dimensions=CandidateDimensions(hook=20, flow=20, value=20, shareability=20),
    )
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    monkeypatch.setattr(
        "app.api.v1.clipsfree2.CommandTranscriptionAdapter.from_environment",
        lambda: type(
            "A",
            (),
            {
                "transcribe": lambda _self, _path: [
                    TranscriptSegment(start=0, end=25, text="Ideia real", words=words)
                ]
            },
        )(),
    )
    monkeypatch.setattr(
        "app.api.v1.clipsfree2.CommandAnalysisAdapter.from_environment",
        lambda: type("A", (), {"suggest": lambda _self, _segments: [candidate]})(),
    )

    response = client.post(
        "/api/v1/clipsfree2/sessions",
        json={"asset_id": str(asset_id), "format": "9:16", "caption_style": "destaque"},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "completed"
    assert response.json()["candidates"][0]["quote"] == "Ideia real"

# ruff: noqa: F811

from uuid import uuid4

from app.core.config import get_settings
from app.main import app
from app.models.identity import TenantRecord
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def test_media_upload_creates_tenant_asset_and_atomic_original(
    permission_client, monkeypatch, tmp_path
):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()
    monkeypatch.setattr(
        "app.api.v1.media.probe_media",
        lambda _path: {"duration": 12.5, "width": 1920, "height": 1080, "fps": 30.0},
    )

    response = client.post(
        "/api/v1/media/assets",
        files={"file": ("reportagem.mp4", b"real-video-bytes", "video/mp4")},
        data={"origin": "recording", "project_id": "project-17", "recording_id": "recording-4"},
    )

    assert response.status_code == 201
    asset = response.json()
    assert asset["filename"] == "reportagem.mp4"
    assert asset["asset_type"] == "video"
    assert asset["mime_type"] == "video/mp4"
    assert asset["file_size"] == 16
    assert asset["sha256"] == "c986372cb64bb5d854d6d97a58e6a893564850db144f18b23daea00fcb72d5a5"
    assert asset["media_status"] == "uploaded"
    assert asset["origin"] == "recording"
    assert asset["project_id"] == "project-17"
    assert asset["recording_id"] == "recording-4"
    assert asset["duration"] == 12.5
    assert asset["width"] == 1920
    assert asset["stream_url"] == f"/api/v1/media/assets/{asset['id']}/stream"
    assert "physical_path" not in asset
    original = tmp_path / asset["tenant_id"] / asset["id"] / "original" / "source.mp4"
    assert original.read_bytes() == b"real-video-bytes"
    assert list(tmp_path.rglob("*.part")) == []

    listed = client.get("/api/v1/media/assets")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()["assets"]] == [asset["id"]]

    get_settings.cache_clear()


def test_local_demo_media_works_without_database(monkeypatch, tmp_path):
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    monkeypatch.setenv("ENVIRONMENT", "local")
    get_settings.cache_clear()
    client = TestClient(app)

    uploaded = client.post(
        "/api/v1/media/local/assets",
        files={"file": ("demo.mp4", b"demo-video", "video/mp4")},
    )
    listed = client.get("/api/v1/media/local/assets")

    assert uploaded.status_code == 201
    asset = uploaded.json()
    assert asset["stream_url"].endswith(f"/media/local/assets/{asset['id']}/stream")
    assert listed.json()["assets"][0]["id"] == asset["id"]
    assert client.get(asset["stream_url"]).content == b"demo-video"
    ranged = client.get(asset["stream_url"], headers={"Range": "bytes=-4"})
    invalid_range = client.get(asset["stream_url"], headers={"Range": "bytes=10-"})
    missing_asset = client.get(f"/api/v1/media/local/assets/{uuid4()}/stream")

    assert ranged.status_code == 206
    assert ranged.content == b"ideo"
    assert ranged.headers["content-range"] == "bytes 6-9/10"
    assert invalid_range.status_code == 416
    assert invalid_range.headers["content-range"] == "bytes */10"
    assert missing_asset.status_code == 404
    assert missing_asset.json()["error_code"] == "MEDIA_NOT_FOUND"
    get_settings.cache_clear()


def test_local_asset_stream_reports_missing_original_file(monkeypatch, tmp_path):
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    monkeypatch.setenv("ENVIRONMENT", "local")
    get_settings.cache_clear()
    client = TestClient(app)
    asset = client.post(
        "/api/v1/media/local/assets",
        files={"file": ("missing.mp4", b"media", "video/mp4")},
    ).json()
    (tmp_path / asset["tenant_id"] / asset["id"] / "original" / "source.mp4").unlink()

    response = client.get(asset["stream_url"])

    assert response.status_code == 404
    assert response.json()["error_code"] == "MEDIA_NOT_FOUND"
    get_settings.cache_clear()


def test_local_clip_export_requires_video_and_returns_rendered_file(monkeypatch, tmp_path):
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    monkeypatch.setenv("ENVIRONMENT", "local")
    get_settings.cache_clear()
    client = TestClient(app)
    image = client.post(
        "/api/v1/media/local/assets",
        files={"file": ("photo.jpg", b"image", "image/jpeg")},
    ).json()
    rejected = client.post(
        "/api/v1/media/local/exports/clip",
        json={"asset_id": image["id"], "duration": 1},
    )
    assert rejected.status_code == 422
    assert rejected.json()["error_code"] == "VIDEO_REQUIRED"

    video = client.post(
        "/api/v1/media/local/assets",
        files={"file": ("story.mp4", b"source", "video/mp4")},
    ).json()

    def fake_render(source, destination, **options):
        assert source.read_bytes() == b"source"
        assert options == {"source_in": 0, "duration": 2, "properties": {}}
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"rendered")

    monkeypatch.setattr("app.api.v1.media.render_media_clip", fake_render)
    exported = client.post(
        "/api/v1/media/local/exports/clip",
        json={"asset_id": video["id"], "duration": 2},
    )

    assert exported.status_code == 200
    assert exported.content == b"rendered"
    assert exported.headers["content-type"].startswith("video/mp4")
    get_settings.cache_clear()


def test_local_timeline_export_skips_out_of_range_and_unknown_catalog_clips(monkeypatch, tmp_path):
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    monkeypatch.setenv("ENVIRONMENT", "local")
    get_settings.cache_clear()
    client = TestClient(app)
    response = client.post(
        "/api/v1/media/local/exports/timeline",
        json={
            "tracks": [
                {
                    "id": "v1",
                    "clips": [
                        {"assetId": "outside", "start": 0, "duration": 1},
                        {"assetId": "unknown", "start": 5, "duration": 1},
                    ],
                }
            ],
            "in_point": 4,
            "out_point": 10,
        },
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "EMPTY_TIMELINE"
    get_settings.cache_clear()


def test_local_thumbnail_background_removal_returns_transparent_png(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    get_settings.cache_clear()
    monkeypatch.setattr(
        "app.api.v1.media.remove_image_background", lambda content: b"png-cutout-" + content
    )
    client = TestClient(app)

    response = client.post(
        "/api/v1/media/local/thumbnails/remove-background",
        files={"file": ("pessoa.jpg", b"portrait", "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/png")
    assert response.content == b"png-cutout-portrait"
    get_settings.cache_clear()


def test_local_thumbnail_background_removal_rejects_non_image(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    get_settings.cache_clear()
    client = TestClient(app)

    response = client.post(
        "/api/v1/media/local/thumbnails/remove-background",
        files={"file": ("pessoa.txt", b"portrait", "text/plain")},
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "IMAGE_REQUIRED"
    get_settings.cache_clear()


def test_media_upload_rejects_oversize_without_orphan(permission_client, monkeypatch, tmp_path):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    monkeypatch.setenv("MEDIA_MAX_UPLOAD_BYTES", "3")
    get_settings.cache_clear()

    response = client.post(
        "/api/v1/media/assets",
        files={"file": ("grande.mp4", b"1234", "video/mp4")},
    )

    assert response.status_code == 413
    assert response.json()["error_code"] == "FILE_TOO_LARGE"
    assert list(tmp_path.rglob("*")) == []
    assert client.get("/api/v1/media/assets").json()["assets"] == []
    get_settings.cache_clear()


def test_media_upload_rejects_invalid_suffix_mime_and_missing_permission(
    permission_client, monkeypatch, tmp_path
):
    client, _ = permission_client
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()


def test_media_upload_rolls_back_catalog_and_removes_stored_file_after_commit_failure(
    permission_client, monkeypatch, tmp_path
):
    client, ids = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()
    original_commit = Session.commit

    def fail_asset_commit(session):
        if any(isinstance(record, TenantRecord) for record in session.new):
            raise RuntimeError("simulated database failure")
        original_commit(session)

    monkeypatch.setattr(Session, "commit", fail_asset_commit)
    response = client.post(
        "/api/v1/media/assets",
        files={"file": ("interrupted.mp4", b"must-not-remain", "video/mp4")},
    )

    assert response.status_code == 500
    assert list(tmp_path.rglob("source.mp4")) == []
    assert list(tmp_path.rglob("*.part")) == []
    with ids["session_factory"]() as session:
        assets = session.scalars(
            select(TenantRecord).where(TenantRecord.entity_type == "Asset")
        ).all()
    assert assets == []
    get_settings.cache_clear()


def test_authenticated_thumbnail_removal_uses_configured_provider(permission_client, monkeypatch):
    client, _ = permission_client
    login(client)
    get_settings.cache_clear()

    async def remove(content, _current, _session):
        return b"cutout:" + content

    monkeypatch.setattr("app.api.v1.media.configured_cutout", remove)
    response = client.post(
        "/api/v1/media/thumbnails/remove-background",
        files={"file": ("portrait.png", b"person", "image/png")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/png")
    assert response.content == b"cutout:person"
    get_settings.cache_clear()


def test_authenticated_stream_and_export_do_not_disclose_or_read_other_tenant_assets(
    permission_client, monkeypatch, tmp_path
):
    client, ids = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()
    foreign = TenantRecord(
        id=uuid4(),
        tenant_id=ids["other"],
        entity_type="Asset",
        data={"filename": "foreign.mp4", "asset_type": "video", "storage_key": "missing"},
    )
    with ids["session_factory"]() as session:
        session.add(foreign)
        session.commit()

    response = client.get(f"/api/v1/media/assets/{foreign.id}/stream")
    export = client.post(
        "/api/v1/media/exports/clip",
        json={"asset_id": str(foreign.id), "duration": 1},
    )

    assert response.status_code == 404
    assert response.json()["error_code"] == "MEDIA_NOT_FOUND"
    assert export.status_code == 404
    assert export.json()["error_code"] == "MEDIA_NOT_FOUND"
    get_settings.cache_clear()
    login(client)

    bad_suffix = client.post(
        "/api/v1/media/assets",
        files={"file": ("programa.exe", b"bad", "application/octet-stream")},
    )
    mismatched_mime = client.post(
        "/api/v1/media/assets",
        files={"file": ("programa.mp4", b"bad", "text/plain")},
    )

    assert bad_suffix.status_code == 422
    assert mismatched_mime.status_code == 422
    assert list(tmp_path.rglob("*")) == []

    client.post("/api/v1/auth/logout")
    login(client, "viewer@mediamind.ai")
    denied = client.post(
        "/api/v1/media/assets",
        files={"file": ("programa.mp4", b"video", "video/mp4")},
    )
    assert denied.status_code == 403
    assert denied.json()["error_code"] == "PERMISSION_DENIED"
    assert list(tmp_path.rglob("*")) == []
    get_settings.cache_clear()


def test_media_stream_supports_full_and_byte_range(permission_client, monkeypatch, tmp_path):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()

    uploaded = client.post(
        "/api/v1/media/assets",
        files={"file": ("seek.mp4", b"0123456789", "video/mp4")},
    ).json()
    full = client.get(uploaded["stream_url"])
    suffix = client.get(uploaded["stream_url"], headers={"Range": "bytes=-4"})
    malformed = client.get(uploaded["stream_url"], headers={"Range": "bytes=1-2,4-5"})

    assert full.status_code == 200
    assert full.content == b"0123456789"
    assert full.headers["cache-control"] == "private, max-age=0"
    assert suffix.status_code == 206
    assert suffix.content == b"6789"
    assert suffix.headers["content-range"] == "bytes 6-9/10"
    assert malformed.status_code == 416
    assert malformed.headers["content-range"] == "bytes */10"
    (tmp_path / uploaded["tenant_id"] / uploaded["id"] / "original" / "source.mp4").unlink()
    missing = client.get(uploaded["stream_url"])
    assert missing.status_code == 404
    assert missing.json()["error_code"] == "MEDIA_NOT_FOUND"
    get_settings.cache_clear()


def test_authenticated_clip_export_rejects_non_video_and_missing_original(
    permission_client, monkeypatch, tmp_path
):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()
    image = client.post(
        "/api/v1/media/assets",
        files={"file": ("poster.jpg", b"image", "image/jpeg")},
    ).json()
    rejected = client.post(
        "/api/v1/media/exports/clip",
        json={"asset_id": image["id"], "duration": 1},
    )
    assert rejected.status_code == 422
    assert rejected.json()["error_code"] == "VIDEO_REQUIRED"

    video = client.post(
        "/api/v1/media/assets",
        files={"file": ("source.mp4", b"video", "video/mp4")},
    ).json()
    (tmp_path / video["tenant_id"] / video["id"] / "original" / "source.mp4").unlink()
    missing = client.post(
        "/api/v1/media/exports/clip",
        json={"asset_id": video["id"], "duration": 1},
    )

    assert missing.status_code == 404
    assert missing.json()["error_code"] == "MEDIA_NOT_FOUND"
    get_settings.cache_clear()


def test_authenticated_timeline_skips_out_of_range_and_invalid_asset_ids(
    permission_client, monkeypatch, tmp_path
):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()
    uploaded = client.post(
        "/api/v1/media/assets",
        files={"file": ("story.mp4", b"video", "video/mp4")},
    ).json()
    response = client.post(
        "/api/v1/media/exports/timeline",
        json={
            "in_point": 4,
            "out_point": 10,
            "tracks": [
                {
                    "id": "v1",
                    "clips": [
                        {"assetId": uploaded["id"], "start": 0, "duration": 1},
                        {"assetId": "not-a-uuid", "start": 5, "duration": 1},
                    ],
                }
            ],
        },
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "EMPTY_TIMELINE"
    get_settings.cache_clear()


def test_export_selected_clip_returns_a_real_download(permission_client, monkeypatch, tmp_path):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()

    uploaded = client.post(
        "/api/v1/media/assets",
        files={"file": ("source.mp4", b"source-video", "video/mp4")},
    ).json()

    def fake_render(source, destination, **options):
        assert source.read_bytes() == b"source-video"
        assert options == {"source_in": 1, "duration": 2.5, "properties": {"speed": 2}}
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"edited-video")

    monkeypatch.setattr("app.api.v1.media.render_media_clip", fake_render)
    response = client.post(
        "/api/v1/media/exports/clip",
        json={
            "asset_id": uploaded["id"],
            "source_in": 1,
            "duration": 2.5,
            "properties": {"speed": 2},
        },
    )

    assert response.status_code == 200
    assert response.content == b"edited-video"
    assert response.headers["content-type"].startswith("video/mp4")
    get_settings.cache_clear()


def test_export_timeline_renders_the_main_storyline(permission_client, monkeypatch, tmp_path):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()

    uploaded = client.post(
        "/api/v1/media/local/assets",
        files={"file": ("story.mp4", b"timeline-video", "video/mp4")},
    )
    assert uploaded.status_code == 201
    asset = uploaded.json()

    def fake_render(segments, destination):
        assert len(segments) == 1
        assert segments[0]["source"].read_bytes() == b"timeline-video"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"timeline-export")

    monkeypatch.setenv("ENVIRONMENT", "local")
    get_settings.cache_clear()
    monkeypatch.setattr("app.api.v1.media.render_timeline", fake_render)
    response = client.post(
        "/api/v1/media/local/exports/timeline",
        json={
            "name": "Reunião / edição!",
            "tracks": [
                {
                    "id": "v1",
                    "clips": [
                        {
                            "assetId": asset["id"],
                            "start": 0,
                            "sourceIn": 1,
                            "duration": 2,
                        }
                    ],
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.content == b"timeline-export"
    assert "Reuni%C3%A3o-edi%C3%A7%C3%A3o-editado.mp4" in response.headers["content-disposition"]
    get_settings.cache_clear()


def test_export_timeline_respects_sequence_in_and_out(permission_client, monkeypatch, tmp_path):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()
    uploaded = client.post(
        "/api/v1/media/assets",
        files={"file": ("story.mp4", b"story-video", "video/mp4")},
    ).json()

    def fake_render(segments, destination):
        assert len(segments) == 1
        assert segments[0]["source_in"] == 4
        assert segments[0]["duration"] == 5
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"selected-range")

    monkeypatch.setattr("app.api.v1.media.render_timeline", fake_render)
    response = client.post(
        "/api/v1/media/exports/timeline",
        json={
            "name": "Trecho",
            "in_point": 3,
            "out_point": 8,
            "tracks": [
                {
                    "id": "v1",
                    "kind": "video",
                    "clips": [
                        {
                            "assetId": uploaded["id"],
                            "start": 2,
                            "sourceIn": 3,
                            "duration": 10,
                            "properties": {"speed": 1},
                        }
                    ],
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.content == b"selected-range"
    get_settings.cache_clear()
    uploaded = client.post(
        "/api/v1/media/assets",
        files={"file": ("story.mp4", b"story-video", "video/mp4")},
    ).json()

    def fake_render(segments, destination):
        assert segments[0]["source"].read_bytes() == b"story-video"
        assert segments[0]["source_in"] == 1
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"complete-storyline")

    monkeypatch.setattr("app.api.v1.media.render_timeline", fake_render)
    response = client.post(
        "/api/v1/media/exports/timeline",
        json={
            "name": "Jornal",
            "tracks": [
                {
                    "id": "v1",
                    "kind": "video",
                    "clips": [
                        {
                            "assetId": uploaded["id"],
                            "start": 0,
                            "sourceIn": 1,
                            "duration": 2,
                            "properties": {"speed": 1},
                        }
                    ],
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.content == b"complete-storyline"
    assert "Jornal-editado.mp4" in response.headers["content-disposition"]
    get_settings.cache_clear()
    uploaded = client.post(
        "/api/v1/media/assets",
        files={"file": ("source.mp4", b"source-video", "video/mp4")},
    ).json()

    def fake_render(source, destination, **_options):
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes() + b"-rendered")

    monkeypatch.setattr("app.api.v1.media.render_media_clip", fake_render)
    response = client.post(
        "/api/v1/media/exports/clip",
        json={
            "asset_id": uploaded["id"],
            "source_in": 1,
            "duration": 2.5,
            "properties": {"speed": 1},
        },
    )

    assert response.status_code == 200
    assert response.content == b"source-video-rendered"
    assert response.headers["content-type"].startswith("video/mp4")
    assert "attachment" in response.headers["content-disposition"]
    get_settings.cache_clear()
    uploaded = client.post(
        "/api/v1/media/assets",
        files={"file": ("seek.mp4", b"0123456789", "video/mp4")},
    ).json()

    complete = client.get(uploaded["stream_url"])
    partial = client.get(uploaded["stream_url"], headers={"Range": "bytes=2-5"})
    invalid = client.get(uploaded["stream_url"], headers={"Range": "bytes=20-30"})

    assert complete.status_code == 200
    assert complete.content == b"0123456789"
    assert complete.headers["accept-ranges"] == "bytes"
    assert complete.headers["content-type"].startswith("video/mp4")
    assert partial.status_code == 206
    assert partial.content == b"2345"
    assert partial.headers["content-range"] == "bytes 2-5/10"
    assert partial.headers["content-length"] == "4"
    assert invalid.status_code == 416
    assert invalid.headers["content-range"] == "bytes */10"
    get_settings.cache_clear()

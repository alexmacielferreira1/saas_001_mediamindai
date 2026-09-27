# ruff: noqa: F811

from app.core.config import get_settings
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
    )

    assert response.status_code == 201
    asset = response.json()
    assert asset["filename"] == "reportagem.mp4"
    assert asset["asset_type"] == "video"
    assert asset["mime_type"] == "video/mp4"
    assert asset["file_size"] == 16
    assert asset["sha256"] == "c986372cb64bb5d854d6d97a58e6a893564850db144f18b23daea00fcb72d5a5"
    assert asset["media_status"] == "uploaded"
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


def test_export_selected_clip_returns_a_real_download(permission_client, monkeypatch, tmp_path):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()


def test_export_timeline_renders_the_main_storyline(permission_client, monkeypatch, tmp_path):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
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

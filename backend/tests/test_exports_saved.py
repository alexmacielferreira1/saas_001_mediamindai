"""Exportações salvas: viram Asset do Acervo e ganham cópia na pasta de destino (EXPORT_ROOT)."""

# ruff: noqa: F811

from datetime import UTC, datetime
from urllib.parse import unquote
from uuid import UUID

import pytest
from app.core.config import get_settings
from app.models.identity import Membership, TenantRecord
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401

TODAY = datetime.now(UTC).strftime("%Y-%m-%d")


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


@pytest.fixture
def folders(monkeypatch, tmp_path):
    media, exports = tmp_path / "media", tmp_path / "destino"
    monkeypatch.setenv("MEDIA_ROOT", str(media))
    monkeypatch.setenv("EXPORT_ROOT", str(exports))
    monkeypatch.setattr("app.api.v1.media.probe_media", lambda _path: {"duration": 2.5})

    def fake_clip(_source, destination, **_options):
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"video-editado")

    def fake_timeline(_segments, destination):
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"sequencia-editada")

    monkeypatch.setattr("app.api.v1.media.render_media_clip", fake_clip)
    monkeypatch.setattr("app.api.v1.media.render_timeline", fake_timeline)
    get_settings.cache_clear()
    yield media, exports
    get_settings.cache_clear()


def upload(client, name="Reportagem Praça.mp4"):
    response = client.post("/api/v1/media/assets", files={"file": (name, b"bruto", "video/mp4")})
    assert response.status_code == 201
    return response.json()["id"]


def export_clip(client, asset_id):
    return client.post(
        "/api/v1/media/exports/clip",
        json={"asset_id": asset_id, "source_in": 0, "duration": 2.5, "properties": {}},
    )


def asset(ids, asset_id):
    with ids["session_factory"]() as session:
        return session.get(TenantRecord, UUID(asset_id)).data


def test_clip_export_is_kept_in_the_library_and_copied_to_destination(permission_client, folders):
    client, ids = permission_client
    media, exports = folders
    login(client)
    source_id = upload(client)

    response = export_clip(client, source_id)

    assert response.status_code == 200
    assert response.content == b"video-editado"
    saved_id = response.headers["X-MediaMind-Asset-Id"]
    relative = f"empresa/{TODAY}/Reportagem-Praça-editado.mp4"
    assert unquote(response.headers["X-MediaMind-Export-Path"]) == relative
    assert (exports / relative).read_bytes() == b"video-editado"
    data = asset(ids, saved_id)
    assert data["origin"] == "export"
    assert data["export_kind"] == "clip"
    assert data["source_asset_ids"] == [source_id]
    assert data["exported_by"] == "admin@mediamind.ai"
    assert data["duration"] == 2.5
    assert data["export_path"] == relative
    # O MP4 temporário foi movido para o Acervo (não sobra cópia em exports/).
    assert not any((media / str(ids["tenant"]) / "exports").rglob("*.mp4"))
    assert client.get(f"/api/v1/media/assets/{saved_id}/stream").content == b"video-editado"
    library = {item["id"] for item in client.get("/api/v1/media/assets").json()["assets"]}
    assert {source_id, saved_id} <= library

    again = export_clip(client, source_id)
    assert unquote(again.headers["X-MediaMind-Export-Path"]).endswith("editado (2).mp4")


def test_timeline_export_is_saved_too(permission_client, folders):
    client, ids = permission_client
    _media, exports = folders
    login(client)
    first, second = upload(client, "a.mp4"), upload(client, "b.mp4")
    clips = [
        {"assetId": first, "start": 0, "duration": 2, "sourceIn": 0},
        {"assetId": second, "start": 2, "duration": 2, "sourceIn": 0},
        {"assetId": first, "start": 4, "duration": 1, "sourceIn": 0},
    ]

    response = client.post(
        "/api/v1/media/exports/timeline",
        json={"name": "Jornal da Noite", "tracks": [{"id": "v1", "kind": "video", "clips": clips}]},
    )

    assert response.status_code == 200
    data = asset(ids, response.headers["X-MediaMind-Asset-Id"])
    assert data["export_kind"] == "timeline"
    assert data["source_asset_ids"] == [first, second]
    assert (exports / "empresa" / TODAY / "Jornal-da-Noite-editado.mp4").exists()


def test_without_destination_folder_the_export_stays_only_in_the_library(
    permission_client, folders, monkeypatch
):
    client, ids = permission_client
    monkeypatch.delenv("EXPORT_ROOT")
    monkeypatch.setattr(
        "app.core.config.Settings.model_config", {**get_settings().model_config, "env_file": None}
    )
    get_settings.cache_clear()
    login(client)

    response = export_clip(client, upload(client))

    assert "X-MediaMind-Export-Path" not in response.headers
    assert asset(ids, response.headers["X-MediaMind-Asset-Id"])["export_path"] is None


def test_copy_failure_does_not_lose_the_export(permission_client, folders, monkeypatch):
    client, ids = permission_client
    _media, exports = folders
    login(client)

    def denied(*_args):
        raise PermissionError(13, "Acesso negado")

    monkeypatch.setattr("app.media.exports.shutil.copyfile", denied)
    response = export_clip(client, upload(client))

    assert response.status_code == 200
    assert response.content == b"video-editado"
    data = asset(ids, response.headers["X-MediaMind-Asset-Id"])
    assert data["export_copy_error"] == (
        "Não foi possível copiar para a pasta de destino: Acesso negado"
    )
    assert not any(exports.rglob("*.part"))


def test_failed_save_removes_the_library_copy(permission_client, folders, monkeypatch):
    client, _ids = permission_client
    media, _exports = folders
    login(client)
    source_id = upload(client)
    original_commit = Session.commit

    def flaky_commit(self):
        if any(getattr(item, "data", {}).get("origin") == "export" for item in self.new):
            raise RuntimeError("banco caiu")
        return original_commit(self)

    monkeypatch.setattr("sqlalchemy.orm.Session.commit", flaky_commit)
    response = export_clip(client, source_id)

    assert response.status_code == 500
    folders_left = [path.parent.parent.name for path in media.rglob("original/source.mp4")]
    assert folders_left == [source_id]


def test_browser_rendered_export_upload_is_copied_to_destination(permission_client, folders):
    client, ids = permission_client
    _media, exports = folders
    login(client)

    exported = client.post(
        "/api/v1/media/assets",
        files={"file": ("Main Edit.webm", b"webm-do-mmfilm", "video/webm")},
        data={"origin": "export"},
    ).json()
    regular = client.post(
        "/api/v1/media/assets",
        files={"file": ("bruto.webm", b"bruto", "video/webm")},
        data={"origin": "ingest"},
    ).json()

    assert exported["export_path"] == f"empresa/{TODAY}/Main-Edit.webm"
    assert (exports / exported["export_path"]).read_bytes() == b"webm-do-mmfilm"
    assert "export_path" not in regular
    assert asset(ids, regular["id"]).get("export_path") is None


def test_each_company_gets_its_own_destination_folder(permission_client, folders):
    client, ids = permission_client
    _media, exports = folders
    with ids["session_factory"]() as session:
        membership = session.scalar(
            select(Membership).where(
                Membership.tenant_id == ids["tenant"], Membership.role == "admin"
            )
        )
        membership.tenant_id = ids["other"]
        membership.role = "superadmin"
        membership.permission_group_id = None
        session.commit()
    login(client)

    response = export_clip(client, upload(client))

    assert unquote(response.headers["X-MediaMind-Export-Path"]).startswith(f"outra/{TODAY}/")
    assert not (exports / "empresa").exists()


def test_viewer_cannot_export(permission_client, folders):
    client, _ids = permission_client
    login(client)
    source_id = upload(client)
    login(client, "viewer@mediamind.ai")

    assert export_clip(client, source_id).status_code == 403

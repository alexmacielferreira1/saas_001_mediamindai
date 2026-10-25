# ruff: noqa: F811
"""Revisão geral 2026-10-24: raiz de arquivos, órfãos, ffprobe e exclusão de mídia."""

import os
import subprocess
import time
from uuid import UUID

from app.models.identity import TenantRecord
from review_helpers import add_member, login_as
from test_creative_tools_api import create_document
from test_permission_groups_api import login, permission_client  # noqa: F401


def upload(client, name="audio.mp3", content=b"media", mime="audio/mpeg"):
    response = client.post("/api/v1/uploads", files={"file": (name, content, mime)})
    assert response.status_code == 201, response.text
    return response.json()


# --- Alta 2: uploads e ZIPs criativos seguem MEDIA_ROOT --------------------------------


def test_upload_is_stored_under_media_root_and_downloaded_as_attachment(
    permission_client, media_root, tmp_path
):
    client, ids = permission_client
    login(client)

    payload = upload(client)
    stored_name = payload["file_url"].rsplit("/", 1)[-1]

    assert (media_root / "uploads" / str(ids["tenant"]) / stored_name).read_bytes() == b"media"
    assert not (tmp_path / "legacy-uploads").exists()
    downloaded = client.get(payload["file_url"])
    assert downloaded.status_code == 200
    assert downloaded.content == b"media"
    assert downloaded.headers["content-disposition"].startswith("attachment")


def test_legacy_upload_saved_before_the_media_root_change_is_still_readable(
    permission_client, media_root, tmp_path
):
    client, ids = permission_client
    login(client)
    legacy = tmp_path / "legacy-uploads" / str(ids["tenant"]) / "antigo.pdf"
    legacy.parent.mkdir(parents=True)
    legacy.write_bytes(b"arquivo antigo")

    response = client.get("/api/v1/uploads/antigo.pdf")

    assert response.status_code == 200
    assert response.content == b"arquivo antigo"


def test_upload_of_one_company_is_not_downloadable_by_another(permission_client, media_root):
    client, ids = permission_client
    login(client)
    payload = upload(client)
    add_member(ids, "outra@mediamind.ai", ["assets.write"], tenant_key="other")

    login_as(client, "outra@mediamind.ai")

    assert client.get(payload["file_url"]).status_code == 404


def test_partial_upload_file_is_never_downloadable(permission_client, media_root):
    client, ids = permission_client
    login(client)
    partial = media_root / "uploads" / str(ids["tenant"]) / ".em-envio.mp4.part"
    partial.parent.mkdir(parents=True)
    partial.write_bytes(b"incompleto")

    assert client.get("/api/v1/uploads/.em-envio.mp4.part").status_code == 404


def test_creative_export_is_written_under_media_root(permission_client, media_root, tmp_path):
    client, ids = permission_client
    login(client)
    created = create_document(client)

    exported = client.post(
        f"/api/v1/creative-documents/{created['id']}/exports",
        data={"revision": "1", "preset": "4:5"},
        files={"file": ("carrossel.zip", b"PK\x03\x04conteudo", "application/zip")},
    )

    assert exported.status_code == 201
    with ids["session_factory"]() as session:
        relative = session.get(TenantRecord, UUID(exported.json()["id"])).data["relative_path"]
    assert (media_root / "creative-exports" / relative).read_bytes() == b"PK\x03\x04conteudo"
    assert not (tmp_path / "legacy-creative-exports").exists()
    downloaded = client.get(f"/api/v1/creative-exports/{exported.json()['id']}/download")
    assert downloaded.content == b"PK\x03\x04conteudo"


def test_legacy_creative_export_is_still_downloadable_and_tenant_scoped(
    permission_client, media_root, tmp_path
):
    client, ids = permission_client
    login(client)
    legacy = tmp_path / "legacy-creative-exports" / str(ids["tenant"]) / "antigo.zip"
    legacy.parent.mkdir(parents=True)
    legacy.write_bytes(b"PK antigo")
    with ids["session_factory"]() as session:
        record = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="CreativeExport",
            data={"status": "ready", "relative_path": f"{ids['tenant']}/antigo.zip"},
        )
        session.add(record)
        session.commit()
        export_id = record.id

    assert client.get(f"/api/v1/creative-exports/{export_id}/download").content == b"PK antigo"
    add_member(ids, "outra@mediamind.ai", ["production.write"], tenant_key="other")
    login_as(client, "outra@mediamind.ai")
    assert client.get(f"/api/v1/creative-exports/{export_id}/download").status_code == 404


def test_creative_export_zip_is_removed_when_the_record_cannot_be_saved(
    permission_client, media_root, monkeypatch
):
    client, _ = permission_client
    login(client)
    created = create_document(client)
    calls = []

    def failing_audit(*args, **_kwargs):
        calls.append(args[2])
        raise RuntimeError("falha simulada do banco")

    monkeypatch.setattr("app.api.v1.creative_tools.add_audit", failing_audit)
    response = client.post(
        f"/api/v1/creative-documents/{created['id']}/exports",
        data={"revision": "1", "preset": "4:5"},
        files={"file": ("carrossel.zip", b"PK\x03\x04conteudo", "application/zip")},
    )

    assert response.status_code == 500
    assert calls == ["creative_export.ready"]
    assert [path for path in media_root.rglob("*.zip")] == []


# --- Média 10: ffprobe que estoura o tempo --------------------------------------------


def test_probe_media_timeout_returns_no_metadata(monkeypatch, tmp_path):
    from app.api.v1 import media

    ffmpeg = tmp_path / "ffmpeg"
    ffmpeg.write_bytes(b"")
    (tmp_path / "ffprobe").write_bytes(b"")
    monkeypatch.setattr(media, "find_ffmpeg", lambda: ffmpeg)

    def slow(*_args, **_kwargs):
        raise subprocess.TimeoutExpired(cmd="ffprobe", timeout=30)

    monkeypatch.setattr(media.subprocess, "run", slow)

    assert media.probe_media(tmp_path / "video.mp4") == {}


def test_probe_media_that_cannot_start_returns_no_metadata(monkeypatch, tmp_path):
    from app.api.v1 import media

    ffmpeg = tmp_path / "ffmpeg"
    ffmpeg.write_bytes(b"")
    (tmp_path / "ffprobe").write_bytes(b"")
    monkeypatch.setattr(media, "find_ffmpeg", lambda: ffmpeg)

    def broken(*_args, **_kwargs):
        raise OSError("sem permissão de execução")

    monkeypatch.setattr(media.subprocess, "run", broken)

    assert media.probe_media(tmp_path / "video.mp4") == {}


def test_media_upload_with_probe_timeout_creates_the_asset_without_duration(
    permission_client, media_root, monkeypatch
):
    client, ids = permission_client
    login(client)
    tools = media_root.parent / "ffmpeg-bin"
    tools.mkdir()
    (tools / "ffmpeg.exe").write_bytes(b"")
    (tools / "ffprobe.exe").write_bytes(b"")
    calls = []

    def timeout(*args, **_kwargs):
        calls.append(args)
        raise subprocess.TimeoutExpired(cmd="ffprobe", timeout=30)

    monkeypatch.setattr("app.api.v1.media.subprocess.run", timeout)
    monkeypatch.setattr("app.api.v1.media.find_ffmpeg", lambda: tools / "ffmpeg.exe")
    response = client.post(
        "/api/v1/media/assets",
        files={"file": ("reportagem.mp4", b"video", "video/mp4")},
    )

    assert response.status_code == 201
    assert "duration" not in response.json()
    assert (media_root / str(ids["tenant"]) / response.json()["id"]).is_dir()


def test_media_upload_removes_the_file_when_metadata_step_fails(
    permission_client, media_root, monkeypatch
):
    client, ids = permission_client
    login(client)

    def explode(_path):
        raise RuntimeError("falha inesperada")

    monkeypatch.setattr("app.api.v1.media.probe_media", explode)
    response = client.post(
        "/api/v1/media/assets",
        files={"file": ("reportagem.mp4", b"video", "video/mp4")},
    )

    assert response.status_code == 500
    assert "falha inesperada" not in response.text
    tenant_dir = media_root / str(ids["tenant"])
    assert not tenant_dir.exists() or list(tenant_dir.rglob("*.mp4")) == []
    with ids["session_factory"]() as session:
        assert session.query(TenantRecord).filter_by(entity_type="Asset").count() == 0


# --- Média 11: excluir mídia apaga o arquivo; exportações antigas são limpas -----------


def test_deleting_an_asset_removes_its_stored_files(permission_client, media_root, monkeypatch):
    client, ids = permission_client
    login(client)
    monkeypatch.setattr("app.api.v1.media.probe_media", lambda _path: {})
    asset = client.post(
        "/api/v1/media/assets",
        files={"file": ("reportagem.mp4", b"video", "video/mp4")},
    ).json()
    asset_dir = media_root / str(ids["tenant"]) / asset["id"]
    assert asset_dir.is_dir()

    response = client.delete(f"/api/v1/records/Asset/{asset['id']}")

    assert response.status_code == 204
    assert not asset_dir.exists()


def test_deleting_an_asset_removes_an_unshared_generic_upload(permission_client, media_root):
    client, ids = permission_client
    login(client)
    shared = upload(client, "a.mp3")
    single = upload(client, "b.mp3")
    first = client.post("/api/v1/records/Asset", json={"data": {"file_url": shared["file_url"]}})
    client.post("/api/v1/records/Asset", json={"data": {"file_url": shared["file_url"]}})
    only = client.post("/api/v1/records/Asset", json={"data": {"file_url": single["file_url"]}})
    tenant_dir = media_root / "uploads" / str(ids["tenant"])

    assert client.delete(f"/api/v1/records/Asset/{first.json()['id']}").status_code == 204
    assert client.delete(f"/api/v1/records/Asset/{only.json()['id']}").status_code == 204

    assert (tenant_dir / shared["file_url"].rsplit("/", 1)[-1]).is_file()
    assert not (tenant_dir / single["file_url"].rsplit("/", 1)[-1]).exists()


def test_deleting_asset_ignores_foreign_or_malformed_file_urls(permission_client, media_root):
    client, ids = permission_client
    login(client)
    outside = media_root / "uploads" / str(ids["other"]) / "alheio.mp3"
    outside.parent.mkdir(parents=True)
    outside.write_bytes(b"outra empresa")
    for file_url in [
        f"/api/v1/uploads/../{ids['other']}/alheio.mp3",
        "https://cdn.example.test/video.mp4",
        123,
    ]:
        created = client.post("/api/v1/records/Asset", json={"data": {"file_url": file_url}})
        assert client.delete(f"/api/v1/records/Asset/{created.json()['id']}").status_code == 204
    assert outside.read_bytes() == b"outra empresa"


def test_asset_of_another_company_cannot_be_deleted_and_keeps_its_file(
    permission_client, media_root, monkeypatch
):
    client, ids = permission_client
    login(client)
    monkeypatch.setattr("app.api.v1.media.probe_media", lambda _path: {})
    asset = client.post(
        "/api/v1/media/assets",
        files={"file": ("reportagem.mp4", b"video", "video/mp4")},
    ).json()
    add_member(ids, "outra@mediamind.ai", ["assets.write"], tenant_key="other")

    login_as(client, "outra@mediamind.ai")
    response = client.delete(f"/api/v1/records/Asset/{asset['id']}")

    assert response.status_code == 404
    assert (media_root / str(ids["tenant"]) / asset["id"]).is_dir()


def test_file_removal_failure_does_not_undo_the_deletion(
    permission_client, media_root, monkeypatch
):
    client, ids = permission_client
    login(client)
    monkeypatch.setattr("app.api.v1.media.probe_media", lambda _path: {})
    asset = client.post(
        "/api/v1/media/assets",
        files={"file": ("reportagem.mp4", b"video", "video/mp4")},
    ).json()

    def locked(*_args, **_kwargs):
        raise OSError("arquivo em uso")

    monkeypatch.setattr("app.media.storage.LocalMediaStorage.delete_asset", locked)
    response = client.delete(f"/api/v1/records/Asset/{asset['id']}")

    assert response.status_code == 204
    assert client.get(f"/api/v1/records/Asset/{asset['id']}").status_code == 404


def test_prune_old_exports_removes_only_expired_export_folders(tmp_path):
    from app.api.v1.media import prune_old_exports

    exports = tmp_path / "exports"
    old = exports / "antigo"
    recent = exports / "recente"
    for folder in (old, recent):
        folder.mkdir(parents=True)
        (folder / "clip.mp4").write_bytes(b"x")
    stray = exports / "solto.txt"
    stray.write_bytes(b"x")
    past = time.time() - 3 * 24 * 3600
    os.utime(old, (past, past))
    os.utime(stray, (past, past))

    prune_old_exports(exports)

    assert not old.exists()
    assert recent.is_dir()
    assert stray.is_file()
    prune_old_exports(tmp_path / "inexistente")


def test_prune_old_exports_tolerates_a_folder_in_use(tmp_path, monkeypatch):
    from app.api.v1 import media

    folder = tmp_path / "exports" / "antigo"
    folder.mkdir(parents=True)
    past = time.time() - 3 * 24 * 3600
    os.utime(folder, (past, past))

    def busy(_directory):
        raise OSError("em uso")

    monkeypatch.setattr(media.LocalMediaStorage, "_remove_tree", staticmethod(busy))
    media.prune_old_exports(tmp_path / "exports")

    assert folder.is_dir()


def test_clip_export_prunes_old_exports_of_the_same_company(
    permission_client, media_root, monkeypatch
):
    client, ids = permission_client
    login(client)
    monkeypatch.setattr("app.api.v1.media.probe_media", lambda _path: {})
    asset = client.post(
        "/api/v1/media/assets",
        files={"file": ("reportagem.mp4", b"video", "video/mp4")},
    ).json()
    old = media_root / str(ids["tenant"]) / "exports" / "antigo"
    other_old = media_root / str(ids["other"]) / "exports" / "antigo"
    for folder in (old, other_old):
        folder.mkdir(parents=True)
        past = time.time() - 3 * 24 * 3600
        os.utime(folder, (past, past))

    def fake_render(_source, destination, **_kwargs):
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"mp4")

    monkeypatch.setattr("app.api.v1.media.render_media_clip", fake_render)
    response = client.post(
        "/api/v1/media/exports/clip", json={"asset_id": asset["id"], "duration": 1}
    )

    assert response.status_code == 200
    assert not old.exists()
    assert other_old.is_dir()


def test_deleting_asset_whose_upload_is_already_gone_succeeds(permission_client, media_root):
    client, _ = permission_client
    login(client)
    created = client.post(
        "/api/v1/records/Asset", json={"data": {"file_url": "/api/v1/uploads/sumiu.mp4"}}
    )

    assert client.delete(f"/api/v1/records/Asset/{created.json()['id']}").status_code == 204

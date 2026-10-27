# ruff: noqa: F811

from uuid import UUID, uuid4

import pytest
from app.core.config import get_settings
from app.models.identity import Membership, TenantRecord
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


@pytest.fixture
def folders(monkeypatch, tmp_path):
    source = tmp_path / "entrada"
    media = tmp_path / "destino"
    monkeypatch.setenv("INGEST_SOURCE_ROOT", str(source))
    monkeypatch.setenv("MEDIA_ROOT", str(media))
    monkeypatch.setattr("app.api.v1.ingest.probe_media", lambda _path: {"duration": 8.0})
    get_settings.cache_clear()
    company = source / "empresa"
    (company / "Pauta 1").mkdir(parents=True)
    (company / "Pauta 1" / "entrevista.mp4").write_bytes(b"video-entrevista")
    (company / "abertura.wav").write_bytes(b"audio-abertura")
    (company / "notas.txt").write_text("não é mídia")
    (company / ".oculto.mp4").write_bytes(b"oculto")
    yield source, media
    get_settings.cache_clear()


def import_all(client, package_id):
    for _ in range(10):
        package = client.post(f"/api/v1/ingest/packages/{package_id}/import-next").json()
        if package["status"] != "processing":
            return package
    raise AssertionError("o pacote não terminou")


def test_folder_ingest_copies_into_destination_and_creates_assets(permission_client, folders):
    client, ids = permission_client
    source, media = folders
    login(client)

    listed = client.get("/api/v1/ingest/source")
    assert listed.status_code == 200
    body = listed.json()
    assert body["source_folder"] == str((source / "empresa").resolve())
    assert [item["path"] for item in body["files"]] == ["abertura.wav", "Pauta 1/entrevista.mp4"]
    assert body["files"][1]["asset_type"] == "video"
    assert body["files"][1]["imported_asset_id"] is None

    created = client.post(
        "/api/v1/ingest/packages",
        json={
            "name": "Cobertura",
            "program_name": "Jornal da Noite",
            "files": ["Pauta 1/entrevista.mp4", "abertura.wav", "abertura.wav"],
        },
    )
    assert created.status_code == 201
    package = created.json()
    assert package["status"] == "processing"
    assert package["file_count"] == 2
    assert package["owner"] == "admin@mediamind.ai"

    done = import_all(client, package["id"])
    assert done["status"] == "completed"
    assert done["progress"] == 100
    assert [item["status"] for item in done["items"]] == ["imported", "imported"]

    video_id = done["items"][0]["asset_id"]
    with ids["session_factory"]() as session:
        asset = session.get(TenantRecord, UUID(video_id))
        assert asset.tenant_id == ids["tenant"]
        assert asset.data["origin"] == "ingest"
        assert asset.data["package_name"] == "Cobertura"
        assert asset.data["program_name"] == "Jornal da Noite"
        assert asset.data["mime_type"] == "video/mp4"
        assert asset.data["duration"] == 8.0
        assert asset.data["source_path"] == "Pauta 1/entrevista.mp4"
    copy = media / str(ids["tenant"]) / video_id / "original" / "source.mp4"
    assert copy.read_bytes() == b"video-entrevista"
    # A entrada não é alterada.
    assert (source / "empresa" / "Pauta 1" / "entrevista.mp4").read_bytes() == b"video-entrevista"
    assert list(media.rglob("*.part")) == []

    assets = client.get("/api/v1/media/assets").json()["assets"]
    assert {item["id"] for item in assets} == {item["asset_id"] for item in done["items"]}
    assert client.get(f"/api/v1/media/assets/{video_id}/stream").content == b"video-entrevista"

    relisted = client.get("/api/v1/ingest/source").json()["files"]
    assert relisted[1]["imported_asset_id"] == video_id
    packages = client.get("/api/v1/ingest/packages").json()["packages"]
    assert [item["id"] for item in packages] == [package["id"]]


def test_same_content_is_not_copied_twice(permission_client, folders):
    client, _ = permission_client
    source, media = folders
    login(client)
    (source / "empresa" / "copia.mp4").write_bytes(b"video-entrevista")
    package = client.post(
        "/api/v1/ingest/packages",
        json={"name": "Lote", "files": ["Pauta 1/entrevista.mp4", "copia.mp4"]},
    ).json()

    done = import_all(client, package["id"])

    first, second = done["items"]
    assert (first["status"], second["status"]) == ("imported", "duplicate")
    assert second["asset_id"] == first["asset_id"]
    assert len(client.get("/api/v1/media/assets").json()["assets"]) == 1
    assert len(list(media.rglob("source.mp4"))) == 1


def test_missing_file_fails_and_retry_resumes(permission_client, folders):
    client, _ = permission_client
    source, _ = folders
    login(client)
    package = client.post(
        "/api/v1/ingest/packages", json={"name": "Lote", "files": ["abertura.wav"]}
    ).json()
    moved = source / "empresa" / "abertura.wav"
    content = moved.read_bytes()
    moved.unlink()

    failed = import_all(client, package["id"])
    assert failed["status"] == "failed"
    assert failed["failed_count"] == 1
    assert failed["items"][0]["error"] == "O arquivo não está mais na pasta de referência."

    moved.write_bytes(content)
    retried = client.post(f"/api/v1/ingest/packages/{package['id']}/retry").json()
    assert retried["status"] == "processing"
    assert import_all(client, package["id"])["status"] == "completed"


def test_copy_error_is_reported_without_leaving_files(permission_client, folders, monkeypatch):
    client, _ = permission_client
    _, media = folders
    login(client)

    def broken_copy(*_args, **_kwargs):
        raise PermissionError(13, "Acesso negado")

    monkeypatch.setattr("app.media.storage.LocalMediaStorage.save_original_from_path", broken_copy)
    package = client.post(
        "/api/v1/ingest/packages", json={"name": "Lote", "files": ["abertura.wav"]}
    ).json()

    failed = import_all(client, package["id"])

    assert failed["items"][0]["error"] == "Não foi possível copiar o arquivo: Acesso negado"
    assert not media.exists() or list(media.rglob("*.*")) == []


@pytest.mark.parametrize(
    "path", ["../outra/segredo.mp4", "..\\outra\\segredo.mp4", "notas.txt", "nao-existe.mp4"]
)
def test_package_refuses_paths_outside_the_company_folder(permission_client, folders, path):
    client, _ = permission_client
    source, _ = folders
    (source / "outra").mkdir()
    (source / "outra" / "segredo.mp4").write_bytes(b"de outra empresa")
    login(client)

    response = client.post("/api/v1/ingest/packages", json={"name": "Lote", "files": [path]})

    assert response.status_code == 422
    assert response.json()["error_code"] == "INGEST_FILE_NOT_FOUND"


def test_absolute_path_is_refused(permission_client, folders):
    client, _ = permission_client
    source, _ = folders
    login(client)
    target = str(source / "empresa" / "abertura.wav")

    response = client.post("/api/v1/ingest/packages", json={"name": "Lote", "files": [target]})

    assert response.status_code == 422


def test_viewer_cannot_list_or_import_but_sees_packages(permission_client, folders):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")

    assert client.get("/api/v1/ingest/source").status_code == 403
    assert (
        client.post(
            "/api/v1/ingest/packages", json={"name": "Lote", "files": ["abertura.wav"]}
        ).status_code
        == 403
    )
    assert client.post(f"/api/v1/ingest/packages/{uuid4()}/import-next").status_code == 403
    assert client.get("/api/v1/ingest/packages").json() == {"packages": []}


def test_other_company_cannot_see_or_run_the_package(permission_client, folders):
    client, ids = permission_client
    login(client)
    package = client.post(
        "/api/v1/ingest/packages", json={"name": "Lote", "files": ["abertura.wav"]}
    ).json()
    with ids["session_factory"]() as session:
        membership = session.scalar(
            select(Membership).where(
                Membership.tenant_id == ids["tenant"], Membership.role == "admin"
            )
        )
        # Superadmin da outra empresa: passa em qualquer permissão, mas não no isolamento.
        membership.tenant_id = ids["other"]
        membership.role = "superadmin"
        membership.permission_group_id = None
        session.commit()
    login(client)

    assert client.get("/api/v1/ingest/packages").json() == {"packages": []}
    for action in ("import-next", "retry"):
        response = client.post(f"/api/v1/ingest/packages/{package['id']}/{action}")
        assert response.status_code == 404
    # A outra empresa lista só a própria subpasta (vazia).
    assert client.get("/api/v1/ingest/source").json()["files"] == []


def test_source_folder_not_configured(permission_client, monkeypatch, tmp_path):
    client, _ = permission_client
    monkeypatch.delenv("INGEST_SOURCE_ROOT", raising=False)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    monkeypatch.setattr(
        "app.core.config.Settings.model_config", {**get_settings().model_config, "env_file": None}
    )
    get_settings.cache_clear()
    login(client)

    response = client.get("/api/v1/ingest/source")

    assert response.status_code == 409
    assert response.json()["error_code"] == "INGEST_SOURCE_NOT_CONFIGURED"
    get_settings.cache_clear()


def test_listing_is_capped_and_finished_package_is_left_as_is(
    permission_client, folders, monkeypatch
):
    client, _ = permission_client
    source, _ = folders
    login(client)
    monkeypatch.setattr("app.api.v1.ingest.MAX_LISTED_FILES", 1)

    listed = client.get("/api/v1/ingest/source").json()
    assert listed["truncated"] is True
    assert len(listed["files"]) == 1

    package = client.post(
        "/api/v1/ingest/packages",
        json={"name": "Lote", "files": ["abertura.wav", "Pauta 1/entrevista.mp4"]},
    ).json()
    (source / "empresa" / "Pauta 1" / "entrevista.mp4").unlink()
    done = import_all(client, package["id"])
    assert [item["status"] for item in done["items"]] == ["imported", "failed"]
    again = client.post(f"/api/v1/ingest/packages/{package['id']}/import-next").json()
    assert again["items"] == done["items"]
    # Item que falhou não conta como importado na lista da pasta.
    listed = client.get("/api/v1/ingest/source").json()["files"]
    assert [item["imported_asset_id"] is not None for item in listed] == [True]
    # Só o que falhou volta para a fila; o importado continua apontando para o mesmo asset.
    retried = client.post(f"/api/v1/ingest/packages/{package['id']}/retry").json()
    assert [item["status"] for item in retried["items"]] == ["imported", "pending"]
    assert retried["items"][0]["asset_id"] == done["items"][0]["asset_id"]


def test_failed_save_removes_the_copy(permission_client, folders, monkeypatch):
    client, _ = permission_client
    _, media = folders
    login(client)
    package = client.post(
        "/api/v1/ingest/packages", json={"name": "Lote", "files": ["abertura.wav"]}
    ).json()
    original_commit = Session.commit

    def flaky_commit(self):
        # Falha só no commit que grava o Asset novo.
        if any(getattr(item, "entity_type", None) == "Asset" for item in self.new):
            raise RuntimeError("banco caiu")
        return original_commit(self)

    monkeypatch.setattr("sqlalchemy.orm.Session.commit", flaky_commit)
    response = client.post(f"/api/v1/ingest/packages/{package['id']}/import-next")

    assert response.status_code == 500
    assert list(media.rglob("source.wav")) == []


def test_failed_save_of_a_duplicate_keeps_the_existing_asset(
    permission_client, folders, monkeypatch
):
    client, _ = permission_client
    source, media = folders
    login(client)
    (source / "empresa" / "copia.wav").write_bytes(b"audio-abertura")
    package = client.post(
        "/api/v1/ingest/packages", json={"name": "Lote", "files": ["abertura.wav", "copia.wav"]}
    ).json()
    client.post(f"/api/v1/ingest/packages/{package['id']}/import-next")
    original_commit = Session.commit

    def flaky_commit(self):
        records = [
            item for item in self.dirty if getattr(item, "entity_type", None) == "IngestPackage"
        ]
        if any(entry["status"] == "duplicate" for item in records for entry in item.data["items"]):
            raise RuntimeError("banco caiu")
        return original_commit(self)

    monkeypatch.setattr("sqlalchemy.orm.Session.commit", flaky_commit)
    response = client.post(f"/api/v1/ingest/packages/{package['id']}/import-next")

    assert response.status_code == 500
    assert len(list(media.rglob("source.wav"))) == 1

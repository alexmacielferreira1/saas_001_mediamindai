# ruff: noqa: F811

from uuid import uuid4

from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def test_authenticated_member_crud_is_tenant_scoped(permission_client):
    client, ids = permission_client
    login(client)
    created = client.post(
        "/api/v1/records/AgendaEvento", json={"data": {"titulo": "Pauta", "ordem": 2}}
    )
    assert created.status_code == 201
    record_id = created.json()["id"]

    listed = client.get("/api/v1/records/AgendaEvento", params={"sort": "ordem", "limit": 10})
    assert listed.status_code == 200
    assert listed.json()["records"][0]["titulo"] == "Pauta"

    updated = client.patch(
        f"/api/v1/records/AgendaEvento/{record_id}", json={"data": {"titulo": "Nova"}}
    )
    assert updated.json()["titulo"] == "Nova"
    assert updated.json()["ordem"] == 2
    assert client.delete(f"/api/v1/records/AgendaEvento/{record_id}").status_code == 204
    assert client.get(f"/api/v1/records/AgendaEvento/{record_id}").status_code == 404


def test_records_support_bulk_filter_and_bulk_update(permission_client):
    client, _ = permission_client
    login(client)
    bulk = client.post(
        "/api/v1/records/ClipVersion/bulk",
        json={
            "items": [
                {"clip_id": "c1", "is_current": True, "ordem": 2},
                {"clip_id": "c1", "is_current": False, "ordem": 1},
                {"clip_id": "c2", "is_current": True, "ordem": 3},
            ]
        },
    )
    assert bulk.status_code == 201

    filtered = client.post(
        "/api/v1/records/ClipVersion/query",
        json={
            "filters": {"clip_id": "c1"},
            "sort": "ordem",
            "limit": 10,
        },
    )
    assert [item["ordem"] for item in filtered.json()["records"]] == [1, 2]

    changed = client.patch(
        "/api/v1/records/ClipVersion/bulk",
        json={
            "filters": {"clip_id": "c1"},
            "data": {"is_current": False},
        },
    )
    assert changed.json()["updated"] == 2

    newest = client.get("/api/v1/records/ClipVersion", params={"sort": "-created_date", "limit": 2})
    oldest_updated = client.get(
        "/api/v1/records/ClipVersion", params={"sort": "updated_date", "limit": 2}
    )
    assert len(newest.json()["records"]) == 2
    assert len(oldest_updated.json()["records"]) == 2


def test_records_reject_unknown_type_and_unauthenticated_access(permission_client):
    client, _ = permission_client
    assert client.get("/api/v1/records/AgendaEvento").status_code == 401
    login(client)
    response = client.post("/api/v1/records/TipoInventado", json={"data": {}})
    assert response.status_code == 404


def test_record_mutations_create_server_audit_and_audit_is_append_only(permission_client):
    client, _ = permission_client
    login(client)
    created = client.post("/api/v1/records/AgendaEvento", json={"data": {"titulo": "Auditada"}})
    record_id = created.json()["id"]

    logs = client.get("/api/v1/records/LogAuditoria").json()["records"]
    assert logs[-1]["action"] == "record.created"
    assert logs[-1]["entity_type"] == "AgendaEvento"
    assert logs[-1]["entity_id"] == record_id
    assert "user_id" in logs[-1]

    direct = client.post("/api/v1/records/LogAuditoria", json={"data": {"action": "forged"}})
    changed = client.patch(
        f"/api/v1/records/LogAuditoria/{logs[-1]['id']}", json={"data": {"action": "forged"}}
    )
    deleted = client.delete(f"/api/v1/records/LogAuditoria/{logs[-1]['id']}")
    assert direct.status_code == changed.status_code == deleted.status_code == 403


def test_viewer_can_read_but_cannot_mutate_tenant_records(permission_client):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")
    assert client.get("/api/v1/records/AgendaEvento").status_code == 200
    response = client.post("/api/v1/records/AgendaEvento", json={"data": {"titulo": "Negada"}})
    assert response.status_code == 403


def test_asset_mutations_require_the_assets_write_permission(permission_client):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")

    denied = client.post("/api/v1/records/Asset", json={"data": {"title": "Sem permissão"}})

    assert denied.status_code == 403
    assert denied.json()["error_code"] == "PERMISSION_DENIED"

    client.post("/api/v1/auth/logout")
    login(client)
    allowed = client.post("/api/v1/records/Asset", json={"data": {"title": "Permitido"}})
    assert allowed.status_code == 201


def test_domain_mutations_require_the_matching_permission(permission_client):
    client, _ = permission_client
    login(client, "cedoc@mediamind.ai")

    denied = client.post(
        "/api/v1/records/AgendaEvento", json={"data": {"titulo": "Sem permissão"}}
    )

    assert denied.status_code == 403
    assert denied.json()["error_code"] == "PERMISSION_DENIED"

    client.post("/api/v1/auth/logout")
    login(client)
    allowed = client.post(
        "/api/v1/records/AgendaEvento", json={"data": {"titulo": "Permitido"}}
    )
    assert allowed.status_code == 201


def test_every_mutable_record_type_has_an_explicit_write_policy():
    from app.api.v1.records import ALLOWED_TYPES
    from app.tenancy.record_policies import RECORD_WRITE_PERMISSIONS

    assert set(RECORD_WRITE_PERMISSIONS) == ALLOWED_TYPES - {"LogAuditoria"}


def test_upload_requires_the_assets_write_permission(permission_client, monkeypatch, tmp_path):
    client, _ = permission_client
    monkeypatch.setattr("app.api.v1.uploads.UPLOAD_ROOT", tmp_path)
    login(client, "viewer@mediamind.ai")

    response = client.post(
        "/api/v1/uploads",
        files={"file": ("audio.mp3", b"media", "audio/mpeg")},
    )

    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"
    assert list(tmp_path.rglob("*")) == []


def test_record_from_other_tenant_is_not_visible(permission_client):
    client, ids = permission_client
    login(client)
    response = client.get(f"/api/v1/records/AgendaEvento/{uuid4()}")
    assert response.status_code == 404


def test_authenticated_upload_round_trip_and_validation(permission_client, monkeypatch, tmp_path):
    client, _ = permission_client
    login(client)
    monkeypatch.setattr("app.api.v1.uploads.UPLOAD_ROOT", tmp_path)

    uploaded = client.post("/api/v1/uploads", files={"file": ("audio.mp3", b"media", "audio/mpeg")})
    assert uploaded.status_code == 201
    assert (
        uploaded.json()["sha256"]
        == "721c9525ade2ea8903d343ef25cf68b9bf4ab0aad56bb7b01fbe48d09bc7fcf4"
    )
    file_url = uploaded.json()["file_url"]
    downloaded = client.get(file_url)
    assert downloaded.status_code == 200
    assert downloaded.content == b"media"

    rejected = client.post(
        "/api/v1/uploads", files={"file": ("script.exe", b"bad", "application/octet-stream")}
    )
    assert rejected.status_code == 422

    missing = client.get("/api/v1/uploads/missing.mp4")
    traversal = client.get("/api/v1/uploads/..%5Csecret.mp4")
    assert missing.status_code == 404
    assert traversal.status_code == 404

    monkeypatch.setattr("app.api.v1.uploads.MAX_UPLOAD_BYTES", 3)
    too_large = client.post("/api/v1/uploads", files={"file": ("large.mp4", b"1234", "video/mp4")})
    assert too_large.status_code == 413
    assert list(tmp_path.rglob("*.mp4")) == []

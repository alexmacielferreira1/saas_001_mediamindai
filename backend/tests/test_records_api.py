from uuid import uuid4

from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def test_authenticated_member_crud_is_tenant_scoped(permission_client):
    client, ids = permission_client
    login(client)
    created = client.post("/api/v1/records/AgendaEvento", json={"data": {"titulo": "Pauta", "ordem": 2}})
    assert created.status_code == 201
    record_id = created.json()["id"]

    listed = client.get("/api/v1/records/AgendaEvento", params={"sort": "ordem", "limit": 10})
    assert listed.status_code == 200
    assert listed.json()["records"][0]["titulo"] == "Pauta"

    updated = client.patch(f"/api/v1/records/AgendaEvento/{record_id}", json={"data": {"titulo": "Nova"}})
    assert updated.json()["titulo"] == "Nova"
    assert updated.json()["ordem"] == 2
    assert client.delete(f"/api/v1/records/AgendaEvento/{record_id}").status_code == 204
    assert client.get(f"/api/v1/records/AgendaEvento/{record_id}").status_code == 404


def test_records_support_bulk_filter_and_bulk_update(permission_client):
    client, _ = permission_client
    login(client)
    bulk = client.post("/api/v1/records/ClipVersion/bulk", json={"items": [
        {"clip_id": "c1", "is_current": True, "ordem": 2},
        {"clip_id": "c1", "is_current": False, "ordem": 1},
        {"clip_id": "c2", "is_current": True, "ordem": 3},
    ]})
    assert bulk.status_code == 201

    filtered = client.post("/api/v1/records/ClipVersion/query", json={
        "filters": {"clip_id": "c1"}, "sort": "ordem", "limit": 10,
    })
    assert [item["ordem"] for item in filtered.json()["records"]] == [1, 2]

    changed = client.patch("/api/v1/records/ClipVersion/bulk", json={
        "filters": {"clip_id": "c1"}, "data": {"is_current": False},
    })
    assert changed.json()["updated"] == 2

    newest = client.get("/api/v1/records/ClipVersion", params={"sort": "-created_date", "limit": 2})
    oldest_updated = client.get("/api/v1/records/ClipVersion", params={"sort": "updated_date", "limit": 2})
    assert len(newest.json()["records"]) == 2
    assert len(oldest_updated.json()["records"]) == 2


def test_records_reject_unknown_type_and_unauthenticated_access(permission_client):
    client, _ = permission_client
    assert client.get("/api/v1/records/AgendaEvento").status_code == 401
    login(client)
    response = client.post("/api/v1/records/TipoInventado", json={"data": {}})
    assert response.status_code == 404


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
    file_url = uploaded.json()["file_url"]
    downloaded = client.get(file_url)
    assert downloaded.status_code == 200
    assert downloaded.content == b"media"

    rejected = client.post("/api/v1/uploads", files={"file": ("script.exe", b"bad", "application/octet-stream")})
    assert rejected.status_code == 422

    missing = client.get("/api/v1/uploads/missing.mp4")
    traversal = client.get("/api/v1/uploads/..%5Csecret.mp4")
    assert missing.status_code == 404
    assert traversal.status_code == 404

    monkeypatch.setattr("app.api.v1.uploads.MAX_UPLOAD_BYTES", 3)
    too_large = client.post("/api/v1/uploads", files={"file": ("large.mp4", b"1234", "video/mp4")})
    assert too_large.status_code == 413
    assert list(tmp_path.rglob("*.mp4")) == []

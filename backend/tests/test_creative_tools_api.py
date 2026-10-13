# ruff: noqa: F811

from uuid import uuid4

from app.models.identity import TenantRecord
from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def carousel_content(title="Carrossel de teste"):
    return {
        "schema_version": 1,
        "tool_type": "carousel",
        "project_id": None,
        "title": title,
        "format": "4:5",
        "template_id": "institutional-dark",
        "requested_slide_count": 3,
        "briefing": {"source": "independent", "audience": "", "objective": "", "tone": ""},
        "slides": [
            {"id": "s1", "type": "cover", "title": "Capa", "body": ""},
            {"id": "s2", "type": "content", "title": "Conteúdo", "body": "Texto"},
            {"id": "s3", "type": "cta", "title": "Ação", "body": "Salve"},
        ],
        "caption": "Legenda",
        "hashtags": ["#mediamind"],
        "references": [],
    }


def create_document(client, title="Carrossel de teste"):
    response = client.post(
        "/api/v1/creative-documents",
        json={"tool_type": "carousel", "content": carousel_content(title)},
    )
    assert response.status_code == 201
    return response.json()


def test_creative_document_create_list_update_and_approve(permission_client):
    client, _ = permission_client
    login(client)

    created = create_document(client)
    assert created["revision"] == 1
    assert created["status"] == "draft"
    assert created["approved_revision"] is None

    listed = client.get("/api/v1/creative-documents", params={"tool_type": "carousel"})
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()["documents"]] == [created["id"]]

    changed = carousel_content("Título revisado")
    updated = client.patch(f"/api/v1/creative-documents/{created['id']}", json={"content": changed})
    assert updated.status_code == 200
    assert updated.json()["revision"] == 2
    assert updated.json()["content"]["title"] == "Título revisado"

    approved = client.post(f"/api/v1/creative-documents/{created['id']}/approve")
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert approved.json()["approved_revision"] == 2


def test_creative_document_rejects_invalid_payload_without_changing_current(permission_client):
    client, _ = permission_client
    login(client)
    created = create_document(client)
    invalid = carousel_content()
    invalid["format"] = "story"

    rejected = client.patch(
        f"/api/v1/creative-documents/{created['id']}", json={"content": invalid}
    )

    assert rejected.status_code == 422
    current = client.get(f"/api/v1/creative-documents/{created['id']}").json()
    assert current["revision"] == 1
    assert current["content"]["format"] == "4:5"


def test_creative_document_write_and_approval_require_matching_permissions(permission_client):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")
    viewer_create = client.post(
        "/api/v1/creative-documents",
        json={"tool_type": "carousel", "content": carousel_content()},
    )
    assert viewer_create.status_code == 403

    client.post("/api/v1/auth/logout")
    login(client, "cedoc@mediamind.ai")
    no_production_permission = client.post(
        "/api/v1/creative-documents",
        json={"tool_type": "carousel", "content": carousel_content()},
    )
    assert no_production_permission.status_code == 403

    client.post("/api/v1/auth/logout")
    login(client)
    created = create_document(client)
    client.post("/api/v1/auth/logout")
    login(client, "cedoc@mediamind.ai")
    no_review_permission = client.post(f"/api/v1/creative-documents/{created['id']}/approve")
    assert no_review_permission.status_code == 403


def test_creative_document_is_tenant_scoped_and_audited(permission_client):
    client, ids = permission_client
    login(client)
    created = create_document(client)

    with ids["session_factory"]() as session:
        outside = TenantRecord(
            tenant_id=ids["other"],
            entity_type="CreativeDocument",
            data={
                "tool_type": "carousel",
                "content": carousel_content("Outro tenant"),
                "revision": 1,
                "status": "draft",
                "approved_revision": None,
            },
        )
        session.add(outside)
        session.commit()
        outside_id = outside.id

    assert client.get(f"/api/v1/creative-documents/{outside_id}").status_code == 404
    logs = client.get("/api/v1/records/LogAuditoria").json()["records"]
    assert any(
        item["action"] == "creative_document.created" and item["entity_id"] == created["id"]
        for item in logs
    )


def test_creative_document_rejects_unknown_tool_type(permission_client):
    client, _ = permission_client
    login(client)
    response = client.post(
        "/api/v1/creative-documents",
        json={"tool_type": "unknown", "content": carousel_content()},
    )
    assert response.status_code == 422


def test_creative_export_is_immutable_downloadable_and_tenant_scoped(
    permission_client, monkeypatch, tmp_path
):
    client, _ = permission_client
    login(client)
    created = create_document(client)
    monkeypatch.setattr("app.api.v1.creative_tools.CREATIVE_EXPORT_ROOT", tmp_path)

    exported = client.post(
        f"/api/v1/creative-documents/{created['id']}/exports",
        data={"revision": "1", "preset": "4:5"},
        files={"file": ("carrossel.zip", b"PK\x03\x04conteudo", "application/zip")},
    )

    assert exported.status_code == 201
    payload = exported.json()
    assert payload["revision"] == 1
    assert payload["status"] == "ready"
    assert payload["sha256"] == "7b6b0a2d5d390ef5562217b1de2dd6597311f0cc35ce55a1841b351a3e5bf320"
    downloaded = client.get(f"/api/v1/creative-exports/{payload['id']}/download")
    assert downloaded.status_code == 200
    assert downloaded.content == b"PK\x03\x04conteudo"
    assert client.get(f"/api/v1/creative-exports/{uuid4()}/download").status_code == 404


def test_creative_export_rejects_stale_revision_and_storage_failure(
    permission_client, monkeypatch, tmp_path
):
    client, _ = permission_client
    login(client)
    created = create_document(client)
    changed = carousel_content("Revisão 2")
    client.patch(f"/api/v1/creative-documents/{created['id']}", json={"content": changed})
    monkeypatch.setattr("app.api.v1.creative_tools.CREATIVE_EXPORT_ROOT", tmp_path)

    stale = client.post(
        f"/api/v1/creative-documents/{created['id']}/exports",
        data={"revision": "1", "preset": "4:5"},
        files={"file": ("stale.zip", b"PK\x03\x04stale", "application/zip")},
    )
    assert stale.status_code == 409
    assert list(tmp_path.rglob("*")) == []

    def fail_store(*_args, **_kwargs):
        raise OSError("disk full")

    monkeypatch.setattr("app.api.v1.creative_tools.store_creative_export", fail_store)
    failed = client.post(
        f"/api/v1/creative-documents/{created['id']}/exports",
        data={"revision": "2", "preset": "4:5"},
        files={"file": ("failed.zip", b"PK\x03\x04failed", "application/zip")},
    )
    assert failed.status_code == 500
    with permission_client[1]["session_factory"]() as session:
        exports = list(session.query(TenantRecord).filter_by(entity_type="CreativeExport").all())
    assert exports == []


def test_creative_export_rejects_invalid_payloads(permission_client, monkeypatch, tmp_path):
    client, _ = permission_client
    login(client)
    created = create_document(client)
    monkeypatch.setattr("app.api.v1.creative_tools.CREATIVE_EXPORT_ROOT", tmp_path)

    invalid_type = client.post(
        f"/api/v1/creative-documents/{created['id']}/exports",
        data={"revision": "1", "preset": "4:5"},
        files={"file": ("arquivo.txt", b"texto", "text/plain")},
    )
    invalid_zip = client.post(
        f"/api/v1/creative-documents/{created['id']}/exports",
        data={"revision": "1", "preset": "4:5"},
        files={"file": ("arquivo.zip", b"nao e zip", "application/zip")},
    )
    monkeypatch.setattr("app.api.v1.creative_tools.MAX_CREATIVE_EXPORT_BYTES", 3)
    too_large = client.post(
        f"/api/v1/creative-documents/{created['id']}/exports",
        data={"revision": "1", "preset": "4:5"},
        files={"file": ("arquivo.zip", b"PKconteudo", "application/zip")},
    )

    assert invalid_type.status_code == 422
    assert invalid_zip.status_code == 422
    assert too_large.status_code == 413


def test_creative_export_reports_missing_stored_file(permission_client, monkeypatch, tmp_path):
    client, ids = permission_client
    login(client)
    created = create_document(client)
    monkeypatch.setattr("app.api.v1.creative_tools.CREATIVE_EXPORT_ROOT", tmp_path)
    exported = client.post(
        f"/api/v1/creative-documents/{created['id']}/exports",
        data={"revision": "1", "preset": "4:5"},
        files={"file": ("carrossel.zip", b"PK\x03\x04conteudo", "application/zip")},
    )
    with ids["session_factory"]() as session:
        record = session.query(TenantRecord).filter_by(entity_type="CreativeExport").one()
        (tmp_path / record.data["relative_path"]).unlink()
    missing = client.get(f"/api/v1/creative-exports/{exported.json()['id']}/download")
    assert missing.status_code == 404

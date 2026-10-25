# ruff: noqa: F811
"""Revisão geral 2026-10-24: aprovação, publicação e edição concorrente."""

from app.models.identity import TenantRecord
from review_helpers import add_member, login_as
from test_creative_tools_api import carousel_content, create_document
from test_permission_groups_api import login, permission_client  # noqa: F401

PRODUCER = "produtor@mediamind.ai"
REVIEWER = "revisor@mediamind.ai"


# --- Alta 3: aprovação de documento criativo só com review.write -----------------------


def test_generic_patch_cannot_approve_a_creative_document_without_review_permission(
    permission_client,
):
    client, ids = permission_client
    login(client)
    document = create_document(client)
    add_member(ids, PRODUCER, ["production.write"])
    login_as(client, PRODUCER)

    approve = client.patch(
        f"/api/v1/records/CreativeDocument/{document['id']}",
        json={"data": {"status": "approved", "approved_revision": 1}},
    )
    status_only = client.patch(
        f"/api/v1/records/CreativeDocument/{document['id']}",
        json={"data": {"status": "approved"}},
    )
    bulk = client.patch(
        "/api/v1/records/CreativeDocument/bulk",
        json={"filters": {}, "data": {"status": "approved"}},
    )
    created_approved = client.post(
        "/api/v1/records/CreativeDocument",
        json={"data": {"tool_type": "thumbnail", "status": "approved"}},
    )

    assert approve.status_code == 422
    assert approve.json()["error_code"] == "SERVER_OWNED_FIELD"
    assert status_only.status_code == 403
    assert bulk.status_code == 403
    assert created_approved.status_code == 403
    persisted = client.get(f"/api/v1/creative-documents/{document['id']}").json()
    assert persisted["status"] == "draft"
    assert persisted["approved_revision"] is None


def test_generic_records_still_accept_creative_drafts_and_reviewer_status(permission_client):
    client, ids = permission_client
    add_member(ids, PRODUCER, ["production.write"])
    add_member(ids, REVIEWER, ["production.write", "review.write"])
    login_as(client, PRODUCER)

    draft = client.post(
        "/api/v1/records/CreativeDocument",
        json={"data": {"tool_type": "thumbnail", "status": "draft", "revision": 2}},
    )
    assert draft.status_code == 201
    same_status = client.patch(
        f"/api/v1/records/CreativeDocument/{draft.json()['id']}",
        json={"data": {"status": "draft", "title": "Novo título"}},
    )
    assert same_status.status_code == 200

    login_as(client, REVIEWER)
    reviewed = client.patch(
        f"/api/v1/records/CreativeDocument/{draft.json()['id']}",
        json={"data": {"status": "approved"}},
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["status"] == "approved"


def test_editing_an_approved_creative_document_via_records_returns_it_to_draft(
    permission_client,
):
    client, ids = permission_client
    login(client)
    document = create_document(client)
    assert client.post(f"/api/v1/creative-documents/{document['id']}/approve").status_code == 200
    add_member(ids, PRODUCER, ["production.write"])
    login_as(client, PRODUCER)

    edited = client.patch(
        f"/api/v1/records/CreativeDocument/{document['id']}",
        json={"data": {"content": {"title": "Alterado depois da aprovação"}}},
    )

    assert edited.status_code == 200
    assert edited.json()["status"] == "draft"
    assert edited.json()["approved_revision"] == 1


def test_generic_records_cannot_forge_creative_export_link_or_status(permission_client):
    client, _ = permission_client
    login(client)
    for field, value in (("status", "ready"), ("document_id", "x"), ("revision", 9)):
        response = client.post("/api/v1/records/CreativeExport", json={"data": {field: value}})
        assert response.status_code == 422, field
        assert response.json()["error_code"] == "SERVER_OWNED_FIELD"


# --- Média 4: aprovação confere a revisão vista ----------------------------------------


def test_approve_rejects_a_revision_different_from_the_one_reviewed(permission_client):
    client, _ = permission_client
    login(client)
    document = create_document(client)
    client.patch(
        f"/api/v1/creative-documents/{document['id']}",
        json={"content": carousel_content("Revisão 2")},
    )

    stale = client.post(
        f"/api/v1/creative-documents/{document['id']}/approve", json={"revision": 1}
    )
    current = client.post(
        f"/api/v1/creative-documents/{document['id']}/approve", json={"revision": 2}
    )

    assert stale.status_code == 409
    assert stale.json()["error_code"] == "CREATIVE_REVISION_CONFLICT"
    assert current.status_code == 200
    assert current.json()["approved_revision"] == 2


def test_approve_without_body_keeps_working_for_current_clients(permission_client):
    client, _ = permission_client
    login(client)
    document = create_document(client)

    response = client.post(f"/api/v1/creative-documents/{document['id']}/approve")

    assert response.status_code == 200
    assert response.json()["approved_revision"] == 1


def test_approve_of_another_company_document_is_not_found(permission_client):
    client, ids = permission_client
    login(client)
    document = create_document(client)
    add_member(ids, REVIEWER, ["review.write"], tenant_key="other")
    login_as(client, REVIEWER)

    response = client.post(
        f"/api/v1/creative-documents/{document['id']}/approve", json={"revision": 1}
    )

    assert response.status_code == 404


def make_dark_script(client):
    channel = client.post(
        "/api/v1/dark-channels", json={"name": "Canal", "niche": "História"}
    ).json()
    script = client.post(
        f"/api/v1/dark-channels/{channel['id']}/scripts", json={"topic": "Tema"}
    ).json()
    return channel, script


def test_editing_an_approved_dark_script_sends_it_back_to_review(permission_client):
    client, _ = permission_client
    login(client)
    channel, script = make_dark_script(client)
    url = f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}"
    assert client.patch(url, json={"status": "approved"}).json()["status"] == "approved"

    metadata = client.patch(url, json={"workflow": {"final_title": "Título final"}})
    assert metadata.json()["status"] == "approved"
    edited = client.patch(url, json={"script": "Texto alterado depois da aprovação."})

    assert edited.status_code == 200
    assert edited.json()["status"] == "in_review"
    assert edited.json()["validation_status"] == "pending"


def test_dark_script_edit_with_explicit_status_keeps_the_requested_status(permission_client):
    client, _ = permission_client
    login(client)
    channel, script = make_dark_script(client)
    url = f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}"
    client.patch(url, json={"status": "approved"})

    response = client.patch(url, json={"script": "Revisado e aprovado.", "status": "approved"})

    assert response.json()["status"] == "approved"


# --- Média 5: cada parte da alteração exige a sua permissão ----------------------------


def test_dark_script_approval_with_publication_data_requires_publishing(permission_client):
    client, ids = permission_client
    login(client)
    channel, script = make_dark_script(client)
    add_member(ids, REVIEWER, ["review.write"])
    login_as(client, REVIEWER)
    url = f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}"

    mixed = client.patch(
        url,
        json={
            "status": "approved",
            "workflow": {
                "published_at": "2026-10-24T10:00:00-03:00",
                "publication_url": "https://youtube.example.test/watch?v=1",
            },
        },
    )
    content = client.patch(url, json={"status": "in_review", "script": "Texto do revisor"})
    review_only = client.patch(url, json={"status": "approved"})

    assert mixed.status_code == 403
    assert content.status_code == 403
    assert review_only.status_code == 200
    login(client)
    persisted = client.get(f"/api/v1/dark-channels/{channel['id']}/scripts").json()["scripts"]
    assert persisted[0]["workflow"]["publication_url"] == ""
    assert persisted[0]["script"] == ""


def test_dark_script_publication_by_member_with_every_permission(permission_client):
    client, ids = permission_client
    login(client)
    channel, script = make_dark_script(client)
    add_member(ids, "editor-chefe@mediamind.ai", ["review.write", "publishing.write"])
    login_as(client, "editor-chefe@mediamind.ai")

    response = client.patch(
        f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}",
        json={
            "status": "approved",
            "workflow": {"publication_url": "https://youtube.example.test/watch?v=1"},
        },
    )

    assert response.status_code == 200
    assert response.json()["workflow"]["publication_url"].startswith("https://")


def test_dark_script_of_another_company_cannot_be_updated(permission_client):
    client, ids = permission_client
    login(client)
    channel, script = make_dark_script(client)
    add_member(ids, REVIEWER, ["review.write", "production.write"], tenant_key="other")
    login_as(client, REVIEWER)

    response = client.patch(
        f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}",
        json={"status": "approved"},
    )

    assert response.status_code == 404


# --- Média 9: PATCH concorrente em /records --------------------------------------------


def test_record_patch_with_stale_if_match_is_rejected(permission_client):
    client, _ = permission_client
    login(client)
    created = client.post("/api/v1/records/AgendaEvento", json={"data": {"titulo": "Pauta"}})
    record = created.json()
    first = client.patch(
        f"/api/v1/records/AgendaEvento/{record['id']}",
        json={"data": {"titulo": "Primeira"}},
        headers={"If-Match": record["updated_date"]},
    )
    assert first.status_code == 200

    stale = client.patch(
        f"/api/v1/records/AgendaEvento/{record['id']}",
        json={"data": {"local": "Estúdio"}},
        headers={"If-Match": f'"{record["updated_date"]}"'},
    )
    fresh = client.patch(
        f"/api/v1/records/AgendaEvento/{record['id']}",
        json={"data": {"local": "Estúdio"}},
        headers={"If-Match": f'W/"{first.json()["updated_date"]}"'},
    )
    wildcard = client.patch(
        f"/api/v1/records/AgendaEvento/{record['id']}",
        json={"data": {"ordem": 1}},
        headers={"If-Match": "*"},
    )

    assert stale.status_code == 409
    assert stale.json()["error_code"] == "RECORD_VERSION_CONFLICT"
    assert fresh.status_code == 200
    assert fresh.json() | {"titulo": "Primeira", "local": "Estúdio"} == fresh.json()
    assert wildcard.status_code == 200


def test_record_patch_merges_from_the_current_row_state(permission_client):
    """Sem If-Match, o merge parte da linha atual (relida com bloqueio), não de uma cópia."""
    client, ids = permission_client
    login(client)
    created = client.post("/api/v1/records/AgendaEvento", json={"data": {"titulo": "Pauta"}})
    record_id = created.json()["id"]
    with ids["session_factory"]() as session:
        row = session.get(TenantRecord, __import__("uuid").UUID(record_id))
        row.data = {**row.data, "local": "gravado por outra requisição"}
        session.commit()

    response = client.patch(
        f"/api/v1/records/AgendaEvento/{record_id}", json={"data": {"ordem": 3}}
    )

    assert response.json()["local"] == "gravado por outra requisição"
    assert response.json()["titulo"] == "Pauta"
    assert response.json()["ordem"] == 3


def test_record_lookup_for_update_locks_the_row(monkeypatch):
    from app.api.v1 import records
    from sqlalchemy.dialects import postgresql

    captured = []

    class FakeSession:
        def scalar(self, statement):
            captured.append(str(statement.compile(dialect=postgresql.dialect())))
            return object()

    records.find_record(FakeSession(), "t", "AgendaEvento", "r", lock=True)
    records.find_record(FakeSession(), "t", "AgendaEvento", "r")

    assert captured[0].endswith("FOR UPDATE")
    assert not captured[1].endswith("FOR UPDATE")


def test_record_patch_with_malformed_if_match_is_rejected(permission_client):
    client, _ = permission_client
    login(client)
    created = client.post("/api/v1/records/AgendaEvento", json={"data": {"titulo": "Pauta"}})

    response = client.patch(
        f"/api/v1/records/AgendaEvento/{created.json()['id']}",
        json={"data": {"titulo": "Nova"}},
        headers={"If-Match": "versao-qualquer"},
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "INVALID_IF_MATCH"

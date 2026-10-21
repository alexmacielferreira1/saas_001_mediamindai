# ruff: noqa: F811

from app.models.identity import Membership, Permission, PermissionGroup, User
from app.security.passwords import hash_password
from sqlalchemy import select
from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401


def login(client, email="admin@mediamind.ai"):
    client.cookies.clear()
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def add_member(ids, email, tenant_key, codes):
    with ids["session_factory"]() as session:
        user = User(email=email, email_normalized=email, password_hash=hash_password(PASSWORD))
        session.add(user)
        session.flush()
        group = PermissionGroup(tenant_id=ids[tenant_key], name=f"Grupo {email}")
        session.add(group)
        session.flush()
        group.permissions.extend(
            session.scalars(select(Permission).where(Permission.code.in_(codes))).all()
        )
        session.add(
            Membership(
                user_id=user.id,
                tenant_id=ids[tenant_key],
                role="admin" if codes else "editor",
                permission_group_id=group.id,
            )
        )
        session.commit()


def create_audited_record(client):
    login(client)
    created = client.post("/api/v1/records/AgendaEvento", json={"data": {"titulo": "Pauta"}})
    assert created.status_code == 201
    logs = client.get("/api/v1/records/LogAuditoria").json()["records"]
    assert logs
    return logs[-1]["id"]


def audit_reads(client, log_id):
    return [
        client.get("/api/v1/records/LogAuditoria"),
        client.post("/api/v1/records/LogAuditoria/query", json={"filters": {}}),
        client.get(f"/api/v1/records/LogAuditoria/{log_id}"),
    ]


def test_viewer_cannot_read_audit_log_by_any_route(permission_client):
    client, _ = permission_client
    log_id = create_audited_record(client)
    login(client, "viewer@mediamind.ai")

    for response in audit_reads(client, log_id):
        assert response.status_code == 403
        assert response.json()["error_code"] == "PERMISSION_DENIED"
        assert "record.created" not in response.text


def test_member_without_admin_permission_cannot_read_audit_log(permission_client):
    client, ids = permission_client
    log_id = create_audited_record(client)
    add_member(ids, "editor@mediamind.ai", "tenant", ["production.write"])
    login(client, "editor@mediamind.ai")

    assert all(response.status_code == 403 for response in audit_reads(client, log_id))
    # Other record types keep the previous behaviour for members.
    assert client.get("/api/v1/records/AgendaEvento").status_code == 200


def test_admin_permissions_can_read_audit_log(permission_client):
    client, _ = permission_client
    log_id = create_audited_record(client)

    for email in ("admin@mediamind.ai", "cedoc@mediamind.ai"):
        login(client, email)
        listed, queried, single = audit_reads(client, log_id)
        assert listed.status_code == 200
        assert queried.status_code == 200
        assert single.status_code == 200
        assert single.json()["action"] == "record.created"


def test_permissions_manage_alone_is_enough_to_read_audit_log(permission_client):
    client, ids = permission_client
    log_id = create_audited_record(client)
    add_member(ids, "perm@mediamind.ai", "tenant", ["permissions.manage"])
    login(client, "perm@mediamind.ai")

    assert all(response.status_code == 200 for response in audit_reads(client, log_id))


def test_admin_of_other_company_sees_no_audit_from_this_company(permission_client):
    client, ids = permission_client
    log_id = create_audited_record(client)
    add_member(ids, "outra@mediamind.ai", "other", ["users.manage", "permissions.manage"])
    login(client, "outra@mediamind.ai")

    listed, queried, single = audit_reads(client, log_id)
    assert listed.status_code == 200
    assert listed.json()["records"] == []
    assert queried.json()["records"] == []
    assert single.status_code == 404


def test_audit_log_stays_append_only_for_admins(permission_client):
    client, _ = permission_client
    log_id = create_audited_record(client)

    assert client.post("/api/v1/records/LogAuditoria", json={"data": {}}).status_code == 403
    patched = client.patch(f"/api/v1/records/LogAuditoria/{log_id}", json={"data": {"x": 1}})
    assert patched.status_code == 403
    assert client.delete(f"/api/v1/records/LogAuditoria/{log_id}").status_code == 403

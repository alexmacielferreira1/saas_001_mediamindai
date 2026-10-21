# ruff: noqa: F811
"""MM-003 (tela/recurso no servidor), MM-005 (limite de concessão) e MM-006/MM-008
(auditoria das mudanças de acesso com antes/depois, motivo e correlation_id)."""

from uuid import uuid4

import pytest
from app.models.identity import Membership, Permission, PermissionGroup, TenantRecord, User
from app.security.passwords import hash_password
from app.tenancy.access_policy import (
    ALLOWED_SCREENS,
    effective_screens,
    role_default_screens,
)
from sqlalchemy import select
from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401

ADMIN_CODES = [
    "permissions.manage",
    "users.manage",
    "users.manage_admin",
    "assets.write",
    "production.write",
    "review.write",
    "clips.write",
    "publishing.write",
]


def login(client, email="admin@mediamind.ai"):
    client.cookies.clear()
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def add_member(ids, email, *, role, codes=(), tenant_key="tenant", restricted=(), extra=()):
    with ids["session_factory"]() as session:
        user = User(email=email, email_normalized=email, password_hash=hash_password(PASSWORD))
        session.add(user)
        session.flush()
        group = PermissionGroup(tenant_id=ids[tenant_key], name=f"Grupo {email}")
        session.add(group)
        session.flush()
        group.permissions.extend(
            session.scalars(select(Permission).where(Permission.code.in_(list(codes)))).all()
        )
        membership = Membership(
            user_id=user.id,
            tenant_id=ids[tenant_key],
            role=role,
            permission_group_id=group.id,
            restricted_screens=list(restricted),
            extra_screens=list(extra),
        )
        session.add(membership)
        session.commit()
        return membership.id, group.id


def membership_id(ids, email):
    with ids["session_factory"]() as session:
        return session.scalar(
            select(Membership.id)
            .join(User, User.id == Membership.user_id)
            .where(User.email == email)
        )


def group_id(ids, name):
    with ids["session_factory"]() as session:
        return session.scalar(select(PermissionGroup.id).where(PermissionGroup.name == name))


def audit_rows(ids, action=None):
    with ids["session_factory"]() as session:
        rows = session.scalars(
            select(TenantRecord).where(TenantRecord.entity_type == "LogAuditoria")
        ).all()
        return [row.data for row in rows if action is None or row.data["action"] == action]


def assert_grant_refused(response):
    assert response.status_code == 403
    assert response.json()["error_code"] == "GRANT_EXCEEDS_AUTHORITY"


# --- Política pura --------------------------------------------------------------------


def test_role_default_screens_mirror_frontend_catalog():
    assert role_default_screens("admin") == ALLOWED_SCREENS
    assert role_default_screens("producer") == {"producao"}
    assert role_default_screens("editor") == {"editor_video"}
    assert role_default_screens("diretor_programa") == {"diretor_programa", "gestao"}
    assert role_default_screens("cedoc") == {"cedoc"}
    assert role_default_screens("viewer") == frozenset()


def test_effective_screens_apply_extra_and_restricted():
    membership = Membership(role="cedoc", extra_screens=["producao", "x"], restricted_screens=[])
    assert effective_screens(membership) == {"cedoc", "producao"}
    admin = Membership(role="admin", extra_screens=[], restricted_screens=["gestao"])
    assert "gestao" not in effective_screens(admin)


# --- MM-003: tela restrita e entidades sensíveis no servidor ----------------------------


def test_restricted_assessoria_screen_blocks_its_entities_on_every_route(permission_client):
    client, ids = permission_client
    login(client)
    created = client.post("/api/v1/records/Jornalista", json={"data": {"nome": "Ana"}})
    assert created.status_code == 201
    record_id = created.json()["id"]
    add_member(
        ids,
        "assessor@mediamind.ai",
        role="assessoria",
        codes=["publishing.write", "production.write"],
        restricted=["assessoria"],
    )
    login(client, "assessor@mediamind.ai")

    responses = [
        client.get("/api/v1/records/Jornalista"),
        client.post("/api/v1/records/Jornalista/query", json={"filters": {}}),
        client.get(f"/api/v1/records/Jornalista/{record_id}"),
        client.post("/api/v1/records/Jornalista", json={"data": {"nome": "Bia"}}),
        client.patch(f"/api/v1/records/Jornalista/{record_id}", json={"data": {"nome": "C"}}),
        client.delete(f"/api/v1/records/Jornalista/{record_id}"),
        client.post("/api/v1/records/Release/bulk", json={"items": [{"titulo": "R"}]}),
    ]
    for response in responses:
        assert response.status_code == 403
        assert response.json()["error_code"] == "SCREEN_ACCESS_DENIED"
        assert "Ana" not in response.text
    # O fluxo operacional comum continua liberado.
    assert client.get("/api/v1/records/AgendaEvento").status_code == 200
    assert client.post("/api/v1/records/AgendaEvento", json={"data": {}}).status_code == 201


def test_member_without_restriction_keeps_access_to_assessoria_entities(permission_client):
    client, ids = permission_client
    add_member(ids, "assessor@mediamind.ai", role="assessoria", codes=["publishing.write"])
    login(client, "assessor@mediamind.ai")

    assert client.post("/api/v1/records/Clipping", json={"data": {}}).status_code == 201
    assert client.get("/api/v1/records/Clipping").status_code == 200


def test_restricted_gestao_blocks_audit_and_management_even_for_admin(permission_client):
    client, ids = permission_client
    add_member(ids, "gestor@mediamind.ai", role="admin", codes=ADMIN_CODES, restricted=["gestao"])
    login(client, "gestor@mediamind.ai")

    audit = client.get("/api/v1/records/LogAuditoria")
    overview = client.get("/api/v1/management/overview")

    assert audit.status_code == 403
    assert audit.json()["error_code"] == "SCREEN_ACCESS_DENIED"
    assert overview.status_code == 403
    assert overview.json()["error_code"] == "SCREEN_ACCESS_DENIED"
    login(client)
    assert client.get("/api/v1/management/overview").status_code == 200


def test_restriction_in_other_company_does_not_leak_or_block_this_company(permission_client):
    client, ids = permission_client
    login(client)
    assert client.post("/api/v1/records/Mencao", json={"data": {"t": "A"}}).status_code == 201
    add_member(
        ids,
        "outra@mediamind.ai",
        role="assessoria",
        codes=["publishing.write"],
        tenant_key="other",
    )
    login(client, "outra@mediamind.ai")

    listed = client.get("/api/v1/records/Mencao")

    assert listed.status_code == 200
    assert listed.json()["records"] == []


# --- MM-005: ninguém concede acima da própria autoridade --------------------------------


def test_manager_cannot_create_or_assign_group_with_permissions_it_lacks(permission_client):
    client, ids = permission_client
    login(client, "cedoc@mediamind.ai")
    viewer = ids["viewer_membership"]

    created = client.post(
        "/api/v1/permission-groups",
        json={"name": "Escalada", "permission_codes": ["users.manage_admin"]},
    )
    assigned = client.put(
        f"/api/v1/memberships/{viewer}/permission-group",
        json={"permission_group_id": str(group_id(ids, "Administradores"))},
    )

    assert_grant_refused(created)
    assert_grant_refused(assigned)
    with ids["session_factory"]() as session:
        assert session.get(Membership, viewer).permission_group_id is None
        assert (
            session.scalar(select(PermissionGroup).where(PermissionGroup.name == "Escalada"))
            is None
        )
    assert audit_rows(ids) == []


def test_manager_can_grant_permissions_it_holds(permission_client):
    client, ids = permission_client
    login(client, "cedoc@mediamind.ai")

    created = client.post(
        "/api/v1/permission-groups",
        json={"name": "Gestão de usuários", "permission_codes": ["users.manage"]},
    )
    assigned = client.put(
        f"/api/v1/memberships/{ids['viewer_membership']}/permission-group",
        json={"permission_group_id": created.json()["id"]},
    )

    assert created.status_code == 201
    assert assigned.status_code == 200


def test_manager_cannot_edit_or_deactivate_a_more_powerful_group(permission_client):
    client, ids = permission_client
    login(client, "cedoc@mediamind.ai")
    admin_group = group_id(ids, "Administradores")

    renamed = client.patch(f"/api/v1/permission-groups/{admin_group}", json={"name": "Nada"})
    deleted = client.delete(f"/api/v1/permission-groups/{admin_group}")
    own = group_id(ids, "Gestores CEDOC")
    widened = client.patch(
        f"/api/v1/permission-groups/{own}",
        json={"permission_codes": ["permissions.manage", "users.manage", "assets.write"]},
    )

    assert_grant_refused(renamed)
    assert_grant_refused(deleted)
    assert_grant_refused(widened)


def test_manager_only_grants_screens_it_can_access(permission_client):
    client, ids = permission_client
    login(client, "cedoc@mediamind.ai")
    url = f"/api/v1/memberships/{ids['viewer_membership']}/screens"

    above = client.put(url, json={"extra_screens": ["gestao"], "restricted_screens": []})
    allowed = client.put(url, json={"extra_screens": ["cedoc"], "restricted_screens": ["gestao"]})
    # Retirar uma restrição de tela que o gestor não acessa também é concessão.
    lift = client.put(url, json={"extra_screens": ["cedoc"], "restricted_screens": []})

    assert_grant_refused(above)
    assert allowed.status_code == 200
    assert_grant_refused(lift)


def test_manager_cannot_lift_own_screen_restriction(permission_client):
    client, ids = permission_client
    member, _ = add_member(
        ids,
        "gestor@mediamind.ai",
        role="cedoc",
        codes=["users.manage"],
        restricted=["cedoc"],
    )
    login(client, "gestor@mediamind.ai")

    response = client.put(
        f"/api/v1/memberships/{member}/screens",
        json={"extra_screens": [], "restricted_screens": []},
    )

    assert_grant_refused(response)


def test_manager_cannot_give_a_role_whose_screens_exceed_its_own(permission_client):
    client, ids = permission_client
    login(client, "cedoc@mediamind.ai")
    url = f"/api/v1/memberships/{ids['viewer_membership']}/role"

    above = client.put(url, json={"role": "diretor_programa"})
    same = client.put(url, json={"role": "cedoc", "reason": "Equipe CEDOC"})

    assert_grant_refused(above)
    assert same.status_code == 200


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("role", {"role": "cedoc"}),
        ("screens", {"extra_screens": [], "restricted_screens": ["cedoc"]}),
        ("permission-group", {"permission_group_id": None}),
    ],
)
def test_manager_without_admin_authority_cannot_change_an_admin(permission_client, path, body):
    client, ids = permission_client
    login(client, "cedoc@mediamind.ai")
    admin = membership_id(ids, "admin@mediamind.ai")

    response = client.put(f"/api/v1/memberships/{admin}/{path}", json=body)

    assert_grant_refused(response)


def test_only_superadmin_grants_or_changes_superadmin(permission_client):
    client, ids = permission_client
    superadmin, _ = add_member(ids, "root@mediamind.ai", role="superadmin", codes=ADMIN_CODES)
    login(client)
    viewer_url = f"/api/v1/memberships/{ids['viewer_membership']}/role"

    promote = client.put(viewer_url, json={"role": "superadmin"})
    demote = client.put(f"/api/v1/memberships/{superadmin}/role", json={"role": "editor"})

    assert_grant_refused(promote)
    assert_grant_refused(demote)
    login(client, "root@mediamind.ai")
    assert client.put(viewer_url, json={"role": "superadmin"}).status_code == 200


def test_superadmin_is_not_limited_by_its_own_group(permission_client):
    client, ids = permission_client
    add_member(ids, "root@mediamind.ai", role="superadmin", codes=["permissions.manage"])
    login(client, "root@mediamind.ai")

    response = client.post(
        "/api/v1/permission-groups",
        json={"name": "Publicação", "permission_codes": ["publishing.write"]},
    )

    assert response.status_code == 201


def test_cedoc_cannot_suspend_an_admin(permission_client):
    client, ids = permission_client
    login(client, "cedoc@mediamind.ai")
    with ids["session_factory"]() as session:
        admin_user = session.scalar(select(User.id).where(User.email == "admin@mediamind.ai"))

    response = client.post(
        f"/api/v1/admin/users/{admin_user}/suspend", json={"reason": "Tentativa"}
    )

    assert_grant_refused(response)


def test_membership_changes_stay_scoped_to_selected_company(permission_client):
    client, ids = permission_client
    other_member, _ = add_member(
        ids, "outra@mediamind.ai", role="viewer", codes=[], tenant_key="other"
    )
    login(client)

    for path, body in (
        ("role", {"role": "editor"}),
        ("screens", {"extra_screens": [], "restricted_screens": []}),
        ("permission-group", {"permission_group_id": None}),
    ):
        response = client.put(f"/api/v1/memberships/{other_member}/{path}", json=body)
        assert response.status_code == 404
    assert audit_rows(ids) == []


# --- MM-006/MM-008: auditoria das mudanças de acesso ------------------------------------


def test_role_change_is_audited_with_before_after_reason_and_correlation(permission_client):
    client, ids = permission_client
    login(client)
    viewer = ids["viewer_membership"]

    response = client.put(
        f"/api/v1/memberships/{viewer}/role",
        json={"role": "editor", "reason": "Promoção para edição"},
        headers={"X-Correlation-ID": "corr-role-1"},
    )

    assert response.status_code == 200
    (row,) = audit_rows(ids, "membership.role_changed")
    assert row["entity_type"] == "Membership"
    assert row["entity_id"] == str(viewer)
    assert row["before"] == {"role": "viewer"}
    assert row["after"] == {"role": "editor"}
    assert row["reason"] == "Promoção para edição"
    assert row["correlation_id"] == "corr-role-1"
    assert row["actor_role"] == "admin"
    with ids["session_factory"]() as session:
        assert row["target_user_id"] == str(session.get(Membership, viewer).user_id)


def test_group_and_screen_changes_are_audited(permission_client):
    client, ids = permission_client
    login(client)
    viewer = ids["viewer_membership"]
    admin_group = group_id(ids, "Administradores")

    client.put(
        f"/api/v1/memberships/{viewer}/permission-group",
        json={"permission_group_id": str(admin_group), "reason": "Cobertura"},
    )
    client.put(
        f"/api/v1/memberships/{viewer}/screens",
        json={"extra_screens": ["cedoc"], "restricted_screens": ["gestao"]},
    )

    (group_row,) = audit_rows(ids, "membership.permission_group_changed")
    assert group_row["before"] == {"permission_group_id": None, "permission_group_name": None}
    assert group_row["after"] == {
        "permission_group_id": str(admin_group),
        "permission_group_name": "Administradores",
    }
    assert group_row["reason"] == "Cobertura"
    assert group_row["correlation_id"]
    (screen_row,) = audit_rows(ids, "membership.screens_changed")
    assert screen_row["before"] == {"extra_screens": [], "restricted_screens": []}
    assert screen_row["after"] == {"extra_screens": ["cedoc"], "restricted_screens": ["gestao"]}
    assert "reason" not in screen_row


def test_permission_group_lifecycle_is_audited(permission_client):
    client, ids = permission_client
    login(client)

    created = client.post(
        "/api/v1/permission-groups",
        json={"name": "Revisores", "permission_codes": ["review.write"]},
    ).json()
    client.patch(
        f"/api/v1/permission-groups/{created['id']}",
        json={"permission_codes": ["review.write", "clips.write"], "reason": "Cortes"},
    )
    client.put(
        f"/api/v1/memberships/{ids['viewer_membership']}/permission-group",
        json={"permission_group_id": created["id"]},
    )
    client.delete(f"/api/v1/permission-groups/{created['id']}")

    (create_row,) = audit_rows(ids, "permission_group.created")
    assert create_row["after"]["permission_codes"] == ["review.write"]
    (update_row,) = audit_rows(ids, "permission_group.updated")
    assert update_row["before"]["permission_codes"] == ["review.write"]
    assert update_row["after"]["permission_codes"] == ["clips.write", "review.write"]
    assert update_row["reason"] == "Cortes"
    (delete_row,) = audit_rows(ids, "permission_group.deactivated")
    assert delete_row["before"]["is_active"] is True
    assert delete_row["after"]["is_active"] is False
    assert delete_row["details"] == {"unassigned_memberships": 1}


def test_duplicate_group_name_does_not_leave_orphan_audit(permission_client):
    client, ids = permission_client
    login(client)
    body = {"name": "Duplicado", "permission_codes": []}
    assert client.post("/api/v1/permission-groups", json=body).status_code == 201

    assert client.post("/api/v1/permission-groups", json=body).status_code == 409
    assert len(audit_rows(ids, "permission_group.created")) == 1


def test_user_status_changes_are_audited_with_before_after(permission_client):
    client, ids = permission_client
    login(client)
    with ids["session_factory"]() as session:
        viewer_user = session.get(Membership, ids["viewer_membership"]).user_id

    client.post(f"/api/v1/admin/users/{viewer_user}/suspend", json={"reason": "Férias"})
    client.post(f"/api/v1/admin/users/{viewer_user}/reactivate", json={"reason": "Retorno"})
    client.post(f"/api/v1/admin/users/{viewer_user}/revoke-sessions", json={"reason": "Troca"})

    (suspended,) = audit_rows(ids, "user.suspended")
    assert suspended["before"] == {"status": "active"}
    assert suspended["after"] == {"status": "suspended"}
    assert suspended["reason"] == "Férias"
    assert suspended["details"]["reason"] == "Férias"  # formato antigo preservado
    assert suspended["target_user_id"] == str(viewer_user)
    (reactivated,) = audit_rows(ids, "user.reactivated")
    assert reactivated["before"] == {"status": "suspended"}
    assert reactivated["after"] == {"status": "active"}
    (revoked,) = audit_rows(ids, "user.sessions_revoked")
    assert revoked["reason"] == "Troca"


def test_settings_change_is_audited_with_before_after(permission_client):
    client, ids = permission_client
    login(client)

    response = client.patch(
        "/api/v1/admin/settings",
        json={"organization_name": "Empresa Nova", "timezone": "America/Manaus"},
    )

    assert response.status_code == 200
    (row,) = audit_rows(ids, "settings.updated")
    assert row["before"] == {"organization_name": "Empresa", "timezone": "America/Sao_Paulo"}
    assert row["after"] == {"organization_name": "Empresa Nova", "timezone": "America/Manaus"}
    assert row["details"] == {"fields": ["organization_name", "timezone"]}


def test_access_audit_is_not_visible_to_another_company(permission_client):
    client, ids = permission_client
    login(client)
    client.put(f"/api/v1/memberships/{ids['viewer_membership']}/role", json={"role": "editor"})
    add_member(
        ids,
        "outra@mediamind.ai",
        role="admin",
        codes=["users.manage", "permissions.manage"],
        tenant_key="other",
    )
    login(client, "outra@mediamind.ai")

    listed = client.get("/api/v1/records/LogAuditoria")

    assert listed.status_code == 200
    assert listed.json()["records"] == []


def test_record_audit_carries_correlation_id_from_request(permission_client):
    client, ids = permission_client
    login(client)

    response = client.post(
        "/api/v1/records/AgendaEvento",
        json={"data": {}},
        headers={"X-Correlation-ID": "corr-record-9"},
    )

    assert response.headers["X-Correlation-ID"] == "corr-record-9"
    (row,) = audit_rows(ids, "record.created")
    assert row["correlation_id"] == "corr-record-9"
    assert {"action", "entity_type", "entity_id", "user_id", "details"} <= row.keys()


def test_unknown_membership_still_returns_not_found(permission_client):
    client, _ = permission_client
    login(client, "cedoc@mediamind.ai")

    response = client.put(f"/api/v1/memberships/{uuid4()}/role", json={"role": "cedoc"})

    assert response.status_code == 404


def test_add_audit_outside_a_request_omits_correlation_and_empty_fields():
    from types import SimpleNamespace

    from app.api.v1.records import add_audit
    from app.tenancy.context import CurrentSession

    added = []
    session = SimpleNamespace(add=added.append)
    membership = Membership(tenant_id=uuid4(), role="editor")
    current = CurrentSession(None, SimpleNamespace(id=uuid4()), membership, None)

    add_audit(session, current, "job.done", "Job", "1", reason="Rotina")

    data = added[0].data
    assert "correlation_id" not in data and "before" not in data
    assert data["reason"] == "Rotina" and data["actor_role"] == "editor"

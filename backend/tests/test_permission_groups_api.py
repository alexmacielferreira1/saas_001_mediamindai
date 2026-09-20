from uuid import uuid4

import pytest
from app.db.session import Base, get_session
from app.main import create_app
from app.models.identity import Membership, Permission, PermissionGroup, Tenant, User
from app.security.passwords import hash_password
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

PASSWORD = "senha-local-segura"


@pytest.fixture
def permission_client():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    with testing_session() as session:
        tenant = Tenant(name="Empresa", slug="empresa")
        other = Tenant(name="Outra", slug="outra")
        manager = User(
            email="admin@mediamind.ai",
            email_normalized="admin@mediamind.ai",
            password_hash=hash_password(PASSWORD),
        )
        viewer = User(
            email="viewer@mediamind.ai",
            email_normalized="viewer@mediamind.ai",
            password_hash=hash_password(PASSWORD),
        )
        cedoc = User(
            email="cedoc@mediamind.ai",
            email_normalized="cedoc@mediamind.ai",
            password_hash=hash_password(PASSWORD),
        )
        manage = Permission(code="permissions.manage", description="Gerenciar permissões")
        manage_users = Permission(code="users.manage", description="Gerenciar usuários")
        manage_admins = Permission(code="users.manage_admin", description="Gerenciar admins")
        publish = Permission(code="assets.publish", description="Publicar ativos")
        session.add_all(
            [
                tenant,
                other,
                manager,
                viewer,
                cedoc,
                manage,
                manage_users,
                manage_admins,
                publish,
            ]
        )
        session.flush()
        admin_group = PermissionGroup(tenant_id=tenant.id, name="Administradores")
        session.add(admin_group)
        session.flush()
        admin_group.permissions.extend([manage, manage_users, manage_admins])
        cedoc_group = PermissionGroup(tenant_id=tenant.id, name="Gestores CEDOC")
        session.add(cedoc_group)
        session.flush()
        cedoc_group.permissions.extend([manage, manage_users])
        manager_membership = Membership(
            user_id=manager.id,
            tenant_id=tenant.id,
            role="admin",
            permission_group_id=admin_group.id,
        )
        viewer_membership = Membership(user_id=viewer.id, tenant_id=tenant.id, role="viewer")
        cedoc_membership = Membership(
            user_id=cedoc.id,
            tenant_id=tenant.id,
            role="cedoc",
            permission_group_id=cedoc_group.id,
        )
        session.add_all([manager_membership, viewer_membership, cedoc_membership])
        session.commit()
        ids = {
            "tenant": tenant.id,
            "other": other.id,
            "publish": publish.id,
            "viewer_membership": viewer_membership.id,
            "session_factory": testing_session,
        }

    def override_session():
        with testing_session() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, ids
    Base.metadata.drop_all(engine)
    engine.dispose()


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def test_permission_groups_require_authentication(permission_client):
    client, _ = permission_client

    response = client.get("/api/v1/permission-groups")

    assert response.status_code == 401


def test_authenticated_member_can_list_only_selected_tenant_groups(permission_client):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")

    response = client.get("/api/v1/permission-groups")

    assert response.status_code == 200
    assert [item["name"] for item in response.json()["permission_groups"]] == [
        "Administradores",
        "Gestores CEDOC",
    ]


def test_manager_lists_memberships_without_sensitive_identity_data(permission_client):
    client, _ = permission_client
    login(client)

    response = client.get("/api/v1/memberships")

    assert response.status_code == 200
    memberships = response.json()["memberships"]
    assert [item["email"] for item in memberships] == [
        "admin@mediamind.ai",
        "cedoc@mediamind.ai",
        "viewer@mediamind.ai",
    ]
    assert [item["role"] for item in memberships] == ["admin", "cedoc", "viewer"]
    assert memberships[0]["permission_group_id"] is not None
    assert memberships[1]["permission_group_id"] is not None
    assert memberships[2]["permission_group_id"] is None
    assert "password_hash" not in response.text


def test_member_without_manage_permission_cannot_list_memberships(permission_client):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")

    response = client.get("/api/v1/memberships")

    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"


def test_manager_can_create_group_with_known_permissions(permission_client):
    client, _ = permission_client
    login(client)

    response = client.post(
        "/api/v1/permission-groups",
        json={
            "name": "Publicadores",
            "description": "Pode publicar",
            "permission_codes": ["assets.publish"],
        },
    )

    assert response.status_code == 201
    assert response.json()["permission_codes"] == ["assets.publish"]


def test_create_rejects_duplicate_name_and_unknown_permission(permission_client):
    client, _ = permission_client
    login(client)
    body = {"name": "Publicadores", "permission_codes": ["assets.publish"]}
    assert client.post("/api/v1/permission-groups", json=body).status_code == 201

    duplicate = client.post("/api/v1/permission-groups", json=body)
    unknown = client.post(
        "/api/v1/permission-groups",
        json={"name": "Desconhecido", "permission_codes": ["unknown.execute"]},
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["error_code"] == "PERMISSION_GROUP_CONFLICT"
    assert unknown.status_code == 422
    assert unknown.json()["error_code"] == "UNKNOWN_PERMISSION"


def test_member_without_manage_permission_cannot_mutate_groups(permission_client):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")

    response = client.post(
        "/api/v1/permission-groups", json={"name": "Proibido", "permission_codes": []}
    )

    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"


def test_manager_can_update_and_soft_delete_group(permission_client):
    client, _ = permission_client
    login(client)
    created = client.post(
        "/api/v1/permission-groups",
        json={"name": "Editores", "permission_codes": []},
    ).json()

    updated = client.patch(
        f"/api/v1/permission-groups/{created['id']}",
        json={"description": "Edição", "permission_codes": ["assets.publish"]},
    )
    deleted = client.delete(f"/api/v1/permission-groups/{created['id']}")

    assert updated.status_code == 200
    assert updated.json()["name"] == "Editores"
    assert updated.json()["permission_codes"] == ["assets.publish"]
    assert deleted.status_code == 204


def test_manager_can_assign_group_to_membership_and_delete_unassigns_it(permission_client):
    client, ids = permission_client
    login(client)
    created = client.post(
        "/api/v1/permission-groups",
        json={"name": "Editores", "permission_codes": ["assets.publish"]},
    ).json()

    assigned = client.put(
        f"/api/v1/memberships/{ids['viewer_membership']}/permission-group",
        json={"permission_group_id": created["id"]},
    )

    assert assigned.status_code == 200
    assert assigned.json() == {
        "membership_id": str(ids["viewer_membership"]),
        "permission_group_id": created["id"],
    }
    assert client.delete(f"/api/v1/permission-groups/{created['id']}").status_code == 204
    with ids["session_factory"]() as session:
        membership = session.get(Membership, ids["viewer_membership"])
        assert membership.permission_group_id is None


def test_assignment_rejects_group_or_membership_outside_selected_tenant(permission_client):
    client, ids = permission_client
    login(client)

    unknown_group = client.put(
        f"/api/v1/memberships/{ids['viewer_membership']}/permission-group",
        json={"permission_group_id": str(uuid4())},
    )
    unknown_membership = client.put(
        f"/api/v1/memberships/{uuid4()}/permission-group",
        json={"permission_group_id": None},
    )

    assert unknown_group.status_code == 404
    assert unknown_group.json()["error_code"] == "PERMISSION_GROUP_NOT_FOUND"
    assert unknown_membership.status_code == 404
    assert unknown_membership.json()["error_code"] == "MEMBERSHIP_NOT_FOUND"


def test_member_without_manage_permission_cannot_assign_group(permission_client):
    client, ids = permission_client
    login(client, "viewer@mediamind.ai")

    response = client.put(
        f"/api/v1/memberships/{ids['viewer_membership']}/permission-group",
        json={"permission_group_id": None},
    )

    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"


def test_manager_can_explicitly_unassign_permission_group(permission_client):
    client, ids = permission_client
    login(client)

    response = client.put(
        f"/api/v1/memberships/{ids['viewer_membership']}/permission-group",
        json={"permission_group_id": None},
    )

    assert response.status_code == 200
    assert response.json()["permission_group_id"] is None


def test_authorized_manager_can_update_membership_role(permission_client):
    client, ids = permission_client
    login(client)

    response = client.put(
        f"/api/v1/memberships/{ids['viewer_membership']}/role",
        json={"role": "editor"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "membership_id": str(ids["viewer_membership"]),
        "role": "editor",
    }


def test_cedoc_cannot_grant_administrative_role(permission_client):
    client, ids = permission_client
    login(client, "cedoc@mediamind.ai")

    response = client.put(
        f"/api/v1/memberships/{ids['viewer_membership']}/role",
        json={"role": "admin"},
    )

    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"


def test_role_update_rejects_unknown_role_or_membership(permission_client):
    client, ids = permission_client
    login(client)

    invalid_role = client.put(
        f"/api/v1/memberships/{ids['viewer_membership']}/role",
        json={"role": "invented-role"},
    )
    missing = client.put(
        f"/api/v1/memberships/{uuid4()}/role",
        json={"role": "editor"},
    )

    assert invalid_role.status_code == 422
    assert invalid_role.json()["error_code"] == "VALIDATION_ERROR"
    assert missing.status_code == 404
    assert missing.json()["error_code"] == "MEMBERSHIP_NOT_FOUND"


def test_update_can_rename_and_rejects_duplicate_name(permission_client):
    client, _ = permission_client
    login(client)
    first = client.post(
        "/api/v1/permission-groups",
        json={"name": "Primeiro", "permission_codes": []},
    ).json()
    second = client.post(
        "/api/v1/permission-groups",
        json={"name": "Segundo", "permission_codes": []},
    ).json()

    renamed = client.patch(f"/api/v1/permission-groups/{first['id']}", json={"name": "Renomeado"})
    duplicate = client.patch(
        f"/api/v1/permission-groups/{second['id']}", json={"name": "Renomeado"}
    )

    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Renomeado"
    assert duplicate.status_code == 409
    assert duplicate.json()["error_code"] == "PERMISSION_GROUP_CONFLICT"


@pytest.mark.parametrize("method", ["patch", "delete"])
def test_mutation_of_missing_group_is_not_found(permission_client, method):
    client, _ = permission_client
    login(client)
    path = f"/api/v1/permission-groups/{uuid4()}"

    response = (
        client.patch(path, json={"description": "Nada"})
        if method == "patch"
        else client.delete(path)
    )

    assert response.status_code == 404
    assert response.json()["error_code"] == "PERMISSION_GROUP_NOT_FOUND"

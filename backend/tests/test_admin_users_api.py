from uuid import uuid4

import pytest
from app.db.session import Base, get_session
from app.main import create_app
from app.models.identity import Membership, Permission, PermissionGroup, Tenant, TenantRecord, User
from app.security.passwords import hash_password
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

PASSWORD = "senha-local-segura"


@pytest.fixture
def admin_users_client():
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
            full_name="Administrador",
        )
        target = User(
            email="editor@mediamind.ai",
            email_normalized="editor@mediamind.ai",
            password_hash=hash_password(PASSWORD),
            full_name="Editor Local",
        )
        outsider = User(
            email="fora@mediamind.ai",
            email_normalized="fora@mediamind.ai",
            password_hash=hash_password(PASSWORD),
            full_name="Usuário Externo",
        )
        manage_users = Permission(code="users.manage", description="Gerenciar usuários")
        session.add_all([tenant, other, manager, target, outsider, manage_users])
        session.flush()
        group = PermissionGroup(tenant_id=tenant.id, name="Administradores")
        group.permissions = [manage_users]
        session.add(group)
        session.flush()
        manager_membership = Membership(
            user_id=manager.id,
            tenant_id=tenant.id,
            role="admin",
            permission_group_id=group.id,
        )
        target_membership = Membership(
            user_id=target.id,
            tenant_id=tenant.id,
            role="editor",
        )
        session.add_all(
            [
                manager_membership,
                target_membership,
                Membership(user_id=outsider.id, tenant_id=other.id, role="viewer"),
            ]
        )
        session.commit()
        ids = {
            "target": target.id,
            "outsider": outsider.id,
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


def login(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@mediamind.ai", "password": PASSWORD},
    )
    assert response.status_code == 200


def test_admin_users_list_is_paginated_filterable_and_never_leaks_secrets(admin_users_client):
    client, _ids = admin_users_client
    login(client)

    response = client.get("/api/v1/admin/users?status=active&page=1&page_size=1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["page"] == 1
    assert payload["page_size"] == 1
    assert payload["total"] == 2
    assert len(payload["items"]) == 1
    assert payload["items"][0]["tenant_role"] == "admin"
    assert "password" not in response.text


def test_admin_user_detail_is_scoped_to_selected_tenant(admin_users_client):
    client, ids = admin_users_client
    login(client)

    detail = client.get(f"/api/v1/admin/users/{ids['target']}")
    outside = client.get(f"/api/v1/admin/users/{ids['outsider']}")

    assert detail.status_code == 200
    assert detail.json()["email"] == "editor@mediamind.ai"
    assert detail.json()["status"] == "active"
    assert outside.status_code == 404


def test_admin_can_suspend_user_and_server_appends_audit_event(admin_users_client):
    client, ids = admin_users_client
    login(client)

    response = client.post(
        f"/api/v1/admin/users/{ids['target']}/suspend",
        json={"reason": "Afastamento temporário"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "suspended"
    with ids["session_factory"]() as session:
        user = session.get(User, ids["target"])
        assert user.account_status == "suspended"
        event = session.scalar(
            select(TenantRecord).where(TenantRecord.entity_type == "LogAuditoria")
        )
        assert event is not None
        assert event.data["action"] == "user.suspended"
        assert event.data["entity_id"] == str(ids["target"])
        assert event.data["details"] == {"reason": "Afastamento temporário"}


def test_admin_user_actions_reject_unknown_user_or_invalid_transition(admin_users_client):
    client, ids = admin_users_client
    login(client)

    missing = client.post(
        f"/api/v1/admin/users/{uuid4()}/suspend",
        json={"reason": "Teste"},
    )
    assert missing.status_code == 404

    first = client.post(
        f"/api/v1/admin/users/{ids['target']}/suspend",
        json={"reason": "Teste"},
    )
    second = client.post(
        f"/api/v1/admin/users/{ids['target']}/suspend",
        json={"reason": "Teste repetido"},
    )
    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["error_code"] == "USER_STATUS_CONFLICT"

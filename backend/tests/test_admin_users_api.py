from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from app.db.session import Base, get_session
from app.main import create_app
from app.models.identity import (
    AuthSession,
    Membership,
    Permission,
    PermissionGroup,
    Tenant,
    TenantRecord,
    User,
)
from app.repositories.identity import get_active_membership
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
        manage_permissions = Permission(
            code="permissions.manage", description="Gerenciar configurações"
        )
        session.add_all(
            [tenant, other, manager, target, outsider, manage_users, manage_permissions]
        )
        session.flush()
        group = PermissionGroup(tenant_id=tenant.id, name="Administradores")
        group.permissions = [manage_users, manage_permissions]
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
            "tenant": tenant.id,
            "other_tenant": other.id,
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


def test_admin_users_validate_status_and_trim_search_terms(admin_users_client):
    client, _ids = admin_users_client
    login(client)

    invalid = client.get("/api/v1/admin/users?status=unknown")
    matching = client.get("/api/v1/admin/users?search=%20%20EDITOR%20%20")
    blank = client.get("/api/v1/admin/users?search=%20%20")

    assert invalid.status_code == 422
    assert invalid.json()["error_code"] == "VALIDATION_ERROR"
    assert matching.status_code == 200
    assert [item["email"] for item in matching.json()["items"]] == ["editor@mediamind.ai"]
    assert blank.status_code == 200
    assert blank.json()["total"] == 2


def test_admin_cannot_suspend_own_account(admin_users_client):
    client, _ids = admin_users_client
    login(client)
    current_user = client.get("/api/v1/admin/users?search=admin%40mediamind.ai").json()["items"][0]

    response = client.post(
        f"/api/v1/admin/users/{current_user['id']}/suspend",
        json={"reason": "self suspension must be denied"},
    )

    assert response.status_code == 409
    assert response.json()["error_code"] == "SELF_STATUS_CHANGE"


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
        membership = session.scalar(select(Membership).where(Membership.user_id == user.id))
        assert membership.is_active is False
        assert user.account_status == "active" and user.is_active is True
        event = session.scalar(
            select(TenantRecord).where(TenantRecord.entity_type == "LogAuditoria")
        )
        assert event is not None
        assert event.data["action"] == "user.suspended"
        assert event.data["entity_id"] == str(ids["target"])
        assert event.data["details"] == {"reason": "Afastamento temporário", "revoked_sessions": 0}


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


def test_admin_settings_are_tenant_scoped_validated_persisted_and_audited(admin_users_client):
    client, ids = admin_users_client
    login(client)

    initial = client.get("/api/v1/admin/settings")
    assert initial.status_code == 200
    assert initial.json()["organization_name"] == "Empresa"
    assert initial.json()["timezone"] == "America/Sao_Paulo"

    updated = client.patch(
        "/api/v1/admin/settings",
        json={
            "organization_name": "MediaMind Corp",
            "locale": "pt-BR",
            "timezone": "America/Recife",
            "date_format": "DD/MM/YYYY",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["organization_name"] == "MediaMind Corp"

    invalid = client.patch("/api/v1/admin/settings", json={"locale": "invalid"})
    assert invalid.status_code == 422

    with ids["session_factory"]() as session:
        setting = session.scalar(
            select(TenantRecord).where(TenantRecord.entity_type == "OrganizationSettings")
        )
        audit = session.scalar(
            select(TenantRecord).where(
                TenantRecord.entity_type == "LogAuditoria",
                TenantRecord.data["action"].as_string() == "settings.updated",
            )
        )
        assert setting.data["timezone"] == "America/Recife"
        assert audit is not None


def _open_session(session, user_id, tenant_id):
    row = AuthSession(
        user_id=user_id,
        token_hash=uuid4().hex + uuid4().hex,
        selected_tenant_id=tenant_id,
        expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    session.add(row)
    return row


def test_suspension_only_affects_the_suspending_company(admin_users_client):
    client, ids = admin_users_client
    with ids["session_factory"]() as session:
        session.add(Membership(user_id=ids["target"], tenant_id=ids["other_tenant"], role="editor"))
        here = _open_session(session, ids["target"], ids["tenant"])
        elsewhere = _open_session(session, ids["target"], ids["other_tenant"])
        session.commit()
        here_id, elsewhere_id = here.id, elsewhere.id
    login(client)

    response = client.post(
        f"/api/v1/admin/users/{ids['target']}/suspend", json={"reason": "Afastamento"}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "suspended"
    with ids["session_factory"]() as session:
        assert get_active_membership(session, ids["target"], ids["tenant"]) is None
        assert get_active_membership(session, ids["target"], ids["other_tenant"]) is not None
        assert session.get(User, ids["target"]).is_active is True
        assert session.get(AuthSession, here_id).revoked_at is not None
        assert session.get(AuthSession, elsewhere_id).revoked_at is None
    listed = client.get("/api/v1/admin/users?status=suspended").json()["items"]
    assert [item["id"] for item in listed] == [str(ids["target"])]
    assert all(
        item["id"] != str(ids["target"])
        for item in client.get("/api/v1/admin/users?status=active").json()["items"]
    )


def test_admin_reactivates_suspended_user_with_audit(admin_users_client):
    client, ids = admin_users_client
    login(client)
    not_suspended = client.post(
        f"/api/v1/admin/users/{ids['target']}/reactivate", json={"reason": "Retorno"}
    )
    client.post(f"/api/v1/admin/users/{ids['target']}/suspend", json={"reason": "Pausa"})

    response = client.post(
        f"/api/v1/admin/users/{ids['target']}/reactivate", json={"reason": "Retorno"}
    )

    assert not_suspended.status_code == 409
    assert response.status_code == 200
    assert response.json()["status"] == "active"
    with ids["session_factory"]() as session:
        assert get_active_membership(session, ids["target"], ids["tenant"]) is not None
        actions = [
            row.data["action"]
            for row in session.scalars(
                select(TenantRecord).where(TenantRecord.entity_type == "LogAuditoria")
            )
        ]
    assert "user.reactivated" in actions


def test_reactivation_clears_legacy_account_level_suspension(admin_users_client):
    client, ids = admin_users_client
    with ids["session_factory"]() as session:
        user = session.get(User, ids["target"])
        user.account_status = "suspended"
        user.is_active = False
        session.commit()
    login(client)

    response = client.post(
        f"/api/v1/admin/users/{ids['target']}/reactivate", json={"reason": "Retorno"}
    )

    assert response.status_code == 200
    with ids["session_factory"]() as session:
        user = session.get(User, ids["target"])
        assert user.account_status == "active" and user.is_active is True


def test_revoke_sessions_is_scoped_to_company_and_denies_self(admin_users_client):
    client, ids = admin_users_client
    with ids["session_factory"]() as session:
        session.add(Membership(user_id=ids["target"], tenant_id=ids["other_tenant"], role="editor"))
        first = _open_session(session, ids["target"], ids["tenant"])
        second = _open_session(session, ids["target"], ids["tenant"])
        elsewhere = _open_session(session, ids["target"], ids["other_tenant"])
        session.commit()
        first_id, second_id, elsewhere_id = first.id, second.id, elsewhere.id
    login(client)
    me = client.get("/api/v1/admin/users?search=admin%40mediamind.ai").json()["items"][0]

    response = client.post(
        f"/api/v1/admin/users/{ids['target']}/revoke-sessions", json={"reason": "Troca"}
    )
    own = client.post(
        f"/api/v1/admin/users/{me['id']}/revoke-sessions", json={"reason": "Minha sessão"}
    )

    assert response.status_code == 200
    assert response.json() == {"revoked_sessions": 2}
    assert own.status_code == 409
    assert own.json()["error_code"] == "SELF_SESSION_REVOKE"
    with ids["session_factory"]() as session:
        assert session.get(AuthSession, first_id).revoked_at is not None
        assert session.get(AuthSession, second_id).revoked_at is not None
        assert session.get(AuthSession, elsewhere_id).revoked_at is None


def test_new_user_actions_cannot_reach_other_company_users(admin_users_client):
    client, ids = admin_users_client
    login(client)
    for action in ("reactivate", "revoke-sessions"):
        response = client.post(
            f"/api/v1/admin/users/{ids['outsider']}/{action}", json={"reason": "Tentativa"}
        )
        assert response.status_code == 404
    with ids["session_factory"]() as session:
        assert get_active_membership(session, ids["outsider"], ids["other_tenant"]) is not None


def test_admin_users_filter_by_other_account_status_stays_in_tenant(admin_users_client):
    client, ids = admin_users_client
    with ids["session_factory"]() as session:
        session.get(User, ids["target"]).account_status = "blocked"
        session.get(User, ids["outsider"]).account_status = "blocked"
        session.commit()
    login(client)

    response = client.get("/api/v1/admin/users?status=blocked")

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["email"] for item in items] == ["editor@mediamind.ai"]


def login_as(client, email):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def test_member_without_users_manage_cannot_use_admin_user_routes(admin_users_client):
    client, ids = admin_users_client
    login_as(client, "editor@mediamind.ai")

    listing = client.get("/api/v1/admin/users")
    detail = client.get(f"/api/v1/admin/users/{ids['target']}")
    suspend = client.post(
        f"/api/v1/admin/users/{ids['target']}/suspend", json={"reason": "Sem permissão"}
    )

    assert listing.status_code == 403
    assert detail.status_code == 403
    assert suspend.status_code == 403
    with ids["session_factory"]() as session:
        assert get_active_membership(session, ids["target"], ids["tenant"]) is not None


def test_member_reads_only_own_company_settings_and_cannot_change_them(admin_users_client):
    client, ids = admin_users_client
    login(client)
    client.patch("/api/v1/admin/settings", json={"timezone": "America/Recife"})
    client.post("/api/v1/auth/logout")

    # Leitura liberada a qualquer membro: só nome, idioma, fuso e formato de data da empresa.
    login_as(client, "editor@mediamind.ai")
    own = client.get("/api/v1/admin/settings")
    change = client.patch("/api/v1/admin/settings", json={"timezone": "America/Manaus"})
    client.post("/api/v1/auth/logout")
    login_as(client, "fora@mediamind.ai")
    other = client.get("/api/v1/admin/settings")

    assert own.status_code == 200
    assert set(own.json()) == {"organization_name", "locale", "timezone", "date_format"}
    assert own.json()["timezone"] == "America/Recife"
    assert change.status_code == 403
    assert other.status_code == 200
    assert other.json()["organization_name"] == "Outra"
    assert other.json()["timezone"] == "America/Sao_Paulo"


def test_admin_settings_second_update_keeps_name_and_previous_fields(admin_users_client):
    client, _ids = admin_users_client
    login(client)

    first = client.patch("/api/v1/admin/settings", json={"timezone": "America/Recife"})
    second = client.patch("/api/v1/admin/settings", json={"date_format": "DD/MM/YYYY"})

    assert first.status_code == 200
    assert second.status_code == 200
    payload = second.json()
    assert payload["organization_name"] == "Empresa"
    assert payload["timezone"] == "America/Recife"
    assert payload["date_format"] == "DD/MM/YYYY"

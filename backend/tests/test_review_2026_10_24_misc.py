# ruff: noqa: F811
"""Revisão geral 2026-10-24: painéis tolerantes, login, suspensão e configurações."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from app.models.identity import AuthSession, Membership, TenantRecord, User
from sqlalchemy import select
from test_admin_users_api import admin_users_client  # noqa: F401
from test_admin_users_api import login as admin_login
from test_auth_api import auth_client  # noqa: F401
from test_auth_api import login as auth_login
from test_permission_groups_api import login, permission_client  # noqa: F401

# --- Média 12: dados livres de um registro não derrubam os painéis ---------------------


def seed(ids, entity_type, rows, tenant_key="tenant"):
    with ids["session_factory"]() as session:
        for data in rows:
            session.add(TenantRecord(tenant_id=ids[tenant_key], entity_type=entity_type, data=data))
        session.commit()


def test_management_overview_tolerates_mixed_dates_and_invalid_sizes(permission_client):
    client, ids = permission_client
    seed(
        ids,
        "Publicacao",
        [
            {"titulo": "A", "data_agendada": "2026-11-01"},
            {"titulo": "B", "data_agendada": 20261102},
            {"titulo": "C", "data_agendada": None, "scheduled_at": {"x": 1}},
        ],
    )
    seed(
        ids,
        "Asset",
        [
            {"file_size": "abc"},
            {"file_size": 10},
            {"size": "20"},
            {"file_size": [1]},
            {"file_size": 2.5},
            {"file_size": True},
        ],
    )
    login(client)

    response = client.get("/api/v1/management/overview")

    assert response.status_code == 200
    payload = response.json()
    assert payload["assets"]["storage_bytes"] == 32
    assert [item["title"] for item in payload["publications"]["calendar"]] == ["C", "A", "B"]
    assert all(isinstance(item["date"], str) for item in payload["publications"]["calendar"])


def test_management_overview_ignores_other_company_data(permission_client):
    client, ids = permission_client
    seed(ids, "Asset", [{"file_size": 999}], tenant_key="other")
    login(client)

    assert client.get("/api/v1/management/overview").json()["assets"]["storage_bytes"] == 0


def test_dashboard_tolerates_mixed_agenda_days_and_times(permission_client):
    client, ids = permission_client
    seed(
        ids,
        "AgendaEvento",
        [
            {"titulo": "Texto", "day": "segunda", "horario": 9},
            {"titulo": "Número", "day": 2, "horario": "10:00"},
            {"titulo": "Sem dia"},
            {"titulo": "Lista", "day": [1], "horario": None},
        ],
    )
    login(client)

    response = client.get("/api/v1/dashboard/me")

    assert response.status_code == 200
    titles = [item["title"] for item in response.json()["upcoming_events"]]
    assert titles[0] == "Número"
    assert sorted(titles) == sorted(["Texto", "Número", "Sem dia", "Lista"])


def test_generic_record_list_sorts_mixed_value_types_without_error(permission_client):
    client, ids = permission_client
    seed(ids, "AgendaEvento", [{"ordem": 2}, {"ordem": "1"}, {"ordem": None}, {"x": 1}])
    login(client)

    response = client.get("/api/v1/records/AgendaEvento", params={"sort": "ordem"})
    query = client.post("/api/v1/records/AgendaEvento/query", json={"sort": "-ordem"})

    assert response.status_code == 200
    assert [item.get("ordem") for item in response.json()["records"]][:2] == [2, "1"]
    assert query.status_code == 200


def test_sort_key_orders_numbers_before_text_and_missing_last():
    from app.api.v1.records import mixed_sort_key

    values = ["b", None, 3, "a", 1.5, True, {"x": 1}]
    assert sorted(values, key=mixed_sort_key) == [True, 1.5, 3, "a", "b", {"x": 1}, None]


# --- Baixa 19: login respeita o estado da conta e o bloqueio por tentativas -----------


@pytest.mark.parametrize("status", ["blocked", "deleted", "suspended"])
def test_password_login_is_refused_for_blocked_account_status(auth_client, status):
    client, factory = auth_client
    with factory() as session:
        session.scalar(select(User)).account_status = status
        session.commit()

    response = auth_login(client)

    assert response.status_code == 401
    assert "mediamind_session" not in response.headers.get("set-cookie", "")


def test_existing_session_stops_working_after_account_is_blocked(auth_client):
    client, factory = auth_client
    assert auth_login(client).status_code == 200
    with factory() as session:
        session.scalar(select(User)).account_status = "blocked"
        session.commit()

    assert client.get("/api/v1/auth/session").status_code == 401


def google_settings():
    return SimpleNamespace(
        google_client_id="google-client",
        google_client_secret=SimpleNamespace(get_secret_value=lambda: "google-secret"),
        google_redirect_uri="http://127.0.0.1:8000/api/v1/auth/google/callback",
        frontend_url="http://127.0.0.1:5173",
        session_cookie_secure=False,
        session_hours=8,
    )


def google_callback(client, monkeypatch):
    monkeypatch.setattr("app.api.v1.auth.get_settings", google_settings)
    monkeypatch.setattr(
        "app.api.v1.auth.exchange_google_code",
        AsyncMock(return_value={"email": "alexmacielferreira@gmail.com", "email_verified": True}),
    )
    start = client.get("/api/v1/auth/google/start", follow_redirects=False)
    state = start.headers["location"].split("state=")[1].split("&")[0]
    return client.get(
        f"/api/v1/auth/google/callback?code=abc&state={state}", follow_redirects=False
    )


def test_google_login_respects_temporary_lockout(auth_client, monkeypatch):
    client, factory = auth_client
    with factory() as session:
        session.scalar(select(User)).locked_until = datetime.now(UTC) + timedelta(minutes=10)
        session.commit()

    response = google_callback(client, monkeypatch)

    assert response.headers["location"].endswith("google_error=account_not_allowed")
    with factory() as session:
        assert session.scalars(select(AuthSession)).all() == []


def test_google_login_after_lockout_expired_is_allowed(auth_client, monkeypatch):
    client, factory = auth_client
    with factory() as session:
        session.scalar(select(User)).locked_until = datetime.now(UTC) - timedelta(minutes=1)
        session.commit()

    response = google_callback(client, monkeypatch)

    assert response.headers["location"].endswith("/corp?tab=producao")


def test_google_login_refuses_blocked_account(auth_client, monkeypatch):
    client, factory = auth_client
    with factory() as session:
        session.scalar(select(User)).account_status = "blocked"
        session.commit()

    response = google_callback(client, monkeypatch)

    assert response.headers["location"].endswith("google_error=account_not_allowed")


# --- Baixa 18: gestor de uma empresa não desfaz suspensão de conta multiempresa --------


def test_company_manager_cannot_lift_account_suspension_of_multi_company_user(
    admin_users_client,
):
    client, ids = admin_users_client
    with ids["session_factory"]() as session:
        session.add(Membership(user_id=ids["target"], tenant_id=ids["other_tenant"], role="editor"))
        user = session.get(User, ids["target"])
        user.account_status = "suspended"
        user.is_active = False
        session.commit()
    admin_login(client)

    response = client.post(
        f"/api/v1/admin/users/{ids['target']}/reactivate", json={"reason": "Retorno"}
    )

    assert response.status_code == 409
    assert response.json()["error_code"] == "ACCOUNT_SUSPENSION_GLOBAL"
    with ids["session_factory"]() as session:
        user = session.get(User, ids["target"])
        assert user.account_status == "suspended" and user.is_active is False


# --- Baixa 22: configuração única da empresa não é criada em dobro ---------------------


def test_organization_settings_update_locks_the_company_row(permission_client, monkeypatch):
    from app.api.v1 import admin_settings

    statements = []
    original = admin_settings.lock_tenant

    def tracking(session, tenant_id):
        statements.append(tenant_id)
        return original(session, tenant_id)

    monkeypatch.setattr(admin_settings, "lock_tenant", tracking)
    client, ids = permission_client
    login(client)

    response = client.patch("/api/v1/admin/settings", json={"timezone": "America/Manaus"})

    assert response.status_code == 200
    assert statements == [ids["tenant"]]


def test_lock_tenant_uses_select_for_update():
    from app.api.v1.admin_settings import lock_tenant
    from sqlalchemy.dialects import postgresql

    captured = []

    class FakeSession:
        def scalar(self, statement):
            captured.append(str(statement.compile(dialect=postgresql.dialect())))
            return "tenant"

    assert lock_tenant(FakeSession(), "t") == "tenant"
    assert captured[0].endswith("FOR UPDATE")


def test_duplicated_organization_settings_read_the_oldest_record(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        session.add(
            TenantRecord(
                tenant_id=ids["tenant"],
                entity_type="OrganizationSettings",
                data={"timezone": "America/Recife"},
                created_at=datetime.now(UTC) - timedelta(days=1),
            )
        )
        session.add(
            TenantRecord(
                tenant_id=ids["tenant"],
                entity_type="OrganizationSettings",
                data={"timezone": "America/Manaus"},
            )
        )
        session.commit()
    login(client)

    assert client.get("/api/v1/admin/settings").json()["timezone"] == "America/Recife"

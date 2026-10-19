import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.db.session import Base, get_session
from app.main import create_app
from app.models.identity import AuthSession, Membership, Tenant, User
from app.security.passwords import hash_password
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

PASSWORD = "senha-local-segura"


@pytest.fixture
def auth_client():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)

    with testing_session() as session:
        user = User(
            email="alexmacielferreira@gmail.com",
            email_normalized="alexmacielferreira@gmail.com",
            password_hash=hash_password(PASSWORD),
            full_name="Alex Maciel Ferreira",
        )
        tenant = Tenant(name="MediaMind Demo", slug="mediamind-demo")
        session.add_all([user, tenant])
        session.flush()
        session.add(Membership(user_id=user.id, tenant_id=tenant.id, role="superadmin"))
        session.commit()

    def override_session():
        with testing_session() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, testing_session
    Base.metadata.drop_all(engine)
    engine.dispose()


def login(client, email="alexmacielferreira@gmail.com", password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_login_sets_opaque_http_only_cookie_and_returns_safe_profile(auth_client):
    client, _ = auth_client
    response = login(client, email="  AlexMacielFerreira@GMAIL.COM ")

    assert response.status_code == 200
    assert response.json() == {
        "user": {
            "id": response.json()["user"]["id"],
            "email": "alexmacielferreira@gmail.com",
            "full_name": "Alex Maciel Ferreira",
        },
        "memberships": [
            {
                "tenant_id": response.json()["memberships"][0]["tenant_id"],
                "tenant_name": "MediaMind Demo",
                "role": "superadmin",
            }
        ],
        "selected_tenant_id": response.json()["memberships"][0]["tenant_id"],
    }
    cookie = response.headers["set-cookie"]
    assert "mediamind_session=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert PASSWORD not in response.text
    assert "password_hash" not in response.text


def test_login_cookie_is_secure_for_cross_origin_https(auth_client, monkeypatch):
    client, _ = auth_client
    monkeypatch.setattr(
        "app.api.v1.auth.get_settings",
        lambda: SimpleNamespace(
            session_cookie_secure=True,
            session_hours=8,
            login_max_attempts=5,
            login_lockout_minutes=15,
        ),
    )

    response = login(client)

    assert response.status_code == 200
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie
    assert "Secure" in cookie
    assert "SameSite=none" in cookie


def test_demo_login_fails_closed_when_server_password_is_not_configured(auth_client, monkeypatch):
    client, _ = auth_client
    monkeypatch.setattr(
        "app.api.v1.auth.get_settings",
        lambda: SimpleNamespace(environment="test", demo_password=None),
    )

    response = client.post(
        "/api/v1/auth/demo",
        json={"email": "alexmacielferreira@gmail.com"},
    )

    assert response.status_code == 503
    assert response.json()["error_code"] == "DEMO_NOT_CONFIGURED"
    assert "mediamind_session=" not in response.headers.get("set-cookie", "")


def test_demo_login_is_hidden_outside_local_and_test_environments(auth_client, monkeypatch):
    client, _ = auth_client
    monkeypatch.setattr(
        "app.api.v1.auth.get_settings",
        lambda: SimpleNamespace(environment="production", demo_password=None),
    )

    response = client.post(
        "/api/v1/auth/demo",
        json={"email": "alexmacielferreira@gmail.com"},
    )

    assert response.status_code == 404
    assert response.json()["error_code"] == "NOT_FOUND"
    assert "mediamind_session=" not in response.headers.get("set-cookie", "")


def test_demo_login_rejects_emails_outside_the_allowlist(auth_client, monkeypatch):
    client, _ = auth_client
    monkeypatch.setattr(
        "app.api.v1.auth.get_settings",
        lambda: SimpleNamespace(environment="test", demo_password=None),
    )

    response = client.post(
        "/api/v1/auth/demo",
        json={"email": "unlisted@example.com"},
    )

    assert response.status_code == 403
    assert response.json()["error_code"] == "DEMO_ACCOUNT_DENIED"
    assert "mediamind_session=" not in response.headers.get("set-cookie", "")


def test_demo_login_uses_configured_server_password(auth_client, monkeypatch):
    client, _ = auth_client
    settings = SimpleNamespace(
        environment="test",
        demo_password=SimpleNamespace(get_secret_value=lambda: PASSWORD),
        session_cookie_secure=False,
        session_hours=8,
        login_max_attempts=5,
        login_lockout_minutes=15,
    )
    monkeypatch.setattr("app.api.v1.auth.get_settings", lambda: settings)

    response = client.post(
        "/api/v1/auth/demo",
        json={"email": "alexmacielferreira@gmail.com"},
    )

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "alexmacielferreira@gmail.com"
    assert "mediamind_session=" in response.headers["set-cookie"]
    assert PASSWORD not in response.text


@pytest.mark.parametrize(
    ("email", "password"),
    [
        ("missing@example.com", PASSWORD),
        ("alexmacielferreira@gmail.com", "senha-errada"),
    ],
)
def test_invalid_credentials_use_the_same_public_response(auth_client, email, password):
    client, _ = auth_client
    response = login(client, email=email, password=password)

    assert response.status_code == 401
    assert response.json()["error_code"] == "INVALID_CREDENTIALS"
    assert response.json()["message"] == "E-mail ou senha inválidos."
    assert "mediamind_session=" not in response.headers.get("set-cookie", "")


def test_inactive_account_does_not_reveal_that_the_email_exists(auth_client):
    client, testing_session = auth_client
    with testing_session() as session:
        user = session.query(User).filter_by(email_normalized="alexmacielferreira@gmail.com").one()
        user.is_active = False
        session.commit()

    response = login(client)
    assert response.status_code == 401
    assert response.json()["error_code"] == "INVALID_CREDENTIALS"
    assert response.json()["message"] == "E-mail ou senha inválidos."


def test_session_survives_a_separate_request_and_logout_revokes_it(auth_client):
    client, _ = auth_client
    assert login(client).status_code == 200

    session_response = client.get("/api/v1/auth/session")
    assert session_response.status_code == 200
    assert session_response.json()["memberships"][0]["role"] == "superadmin"

    logout_response = client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 204
    assert "Max-Age=0" in logout_response.headers["set-cookie"]
    assert client.get("/api/v1/auth/session").status_code == 401


def test_logout_without_a_cookie_is_idempotent(auth_client):
    client, _ = auth_client
    assert client.post("/api/v1/auth/logout").status_code == 204


def test_logout_with_an_unknown_cookie_is_idempotent(auth_client):
    client, _ = auth_client
    client.cookies.set("mediamind_session", "unknown-session")

    assert client.post("/api/v1/auth/logout").status_code == 204


def test_expired_session_is_rejected(auth_client):
    client, testing_session = auth_client
    assert login(client).status_code == 200
    with testing_session() as session:
        stored = session.query(AuthSession).one()
        stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        session.commit()

    response = client.get("/api/v1/auth/session")
    assert response.status_code == 401
    assert response.json()["error_code"] == "AUTHENTICATION_REQUIRED"


def test_google_start_redirects_with_state_cookie(auth_client, monkeypatch):
    client, _ = auth_client
    monkeypatch.setattr(
        "app.api.v1.auth.get_settings",
        lambda: SimpleNamespace(
            google_client_id="google-client",
            google_client_secret=SimpleNamespace(get_secret_value=lambda: "google-secret"),
            google_redirect_uri="http://127.0.0.1:8000/api/v1/auth/google/callback",
            frontend_url="http://127.0.0.1:5173",
            session_cookie_secure=False,
            session_hours=8,
        ),
    )

    response = client.get("/api/v1/auth/google/start", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"].startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert "client_id=google-client" in response.headers["location"]
    assert "mediamind_google_state=" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]


def test_google_callback_logs_in_existing_superadmin(auth_client, monkeypatch):
    client, _ = auth_client
    settings = SimpleNamespace(
        google_client_id="google-client",
        google_client_secret=SimpleNamespace(get_secret_value=lambda: "google-secret"),
        google_redirect_uri="http://127.0.0.1:8000/api/v1/auth/google/callback",
        frontend_url="http://127.0.0.1:5173",
        session_cookie_secure=False,
        session_hours=8,
    )
    monkeypatch.setattr("app.api.v1.auth.get_settings", lambda: settings)
    exchange = AsyncMock(
        return_value={
            "email": "alexmacielferreira@gmail.com",
            "email_verified": True,
        }
    )
    monkeypatch.setattr("app.api.v1.auth.exchange_google_code", exchange)

    start = client.get("/api/v1/auth/google/start", follow_redirects=False)
    state = start.headers["location"].split("state=")[1].split("&")[0]
    response = client.get(
        f"/api/v1/auth/google/callback?code=abc&state={state}",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert response.headers["location"] == "http://127.0.0.1:5173/corp?tab=producao"
    assert "mediamind_session=" in response.headers["set-cookie"]
    assert client.get("/api/v1/auth/session").json()["memberships"][0]["role"] == "superadmin"


def test_google_callback_rejects_unknown_account(auth_client, monkeypatch):
    client, _ = auth_client
    settings = SimpleNamespace(
        google_client_id="google-client",
        google_client_secret=SimpleNamespace(get_secret_value=lambda: "google-secret"),
        google_redirect_uri="http://127.0.0.1:8000/api/v1/auth/google/callback",
        frontend_url="http://127.0.0.1:5173",
        session_cookie_secure=False,
        session_hours=8,
    )
    monkeypatch.setattr("app.api.v1.auth.get_settings", lambda: settings)
    monkeypatch.setattr(
        "app.api.v1.auth.exchange_google_code",
        AsyncMock(return_value={"email": "unknown@example.com", "email_verified": True}),
    )
    start = client.get("/api/v1/auth/google/start", follow_redirects=False)
    state = start.headers["location"].split("state=")[1].split("&")[0]

    response = client.get(
        f"/api/v1/auth/google/callback?code=abc&state={state}",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert response.headers["location"].endswith("/login?google_error=account_not_allowed")


def google_settings():
    return SimpleNamespace(
        google_client_id="google-client",
        google_client_secret=SimpleNamespace(get_secret_value=lambda: "google-secret"),
        google_redirect_uri="http://127.0.0.1:8000/api/v1/auth/google/callback",
        frontend_url="http://127.0.0.1:5173",
        session_cookie_secure=False,
        session_hours=8,
    )


def test_google_start_reports_missing_configuration(auth_client, monkeypatch):
    client, _ = auth_client
    settings = google_settings()
    settings.google_client_id = ""
    monkeypatch.setattr("app.api.v1.auth.get_settings", lambda: settings)

    response = client.get("/api/v1/auth/google/start")

    assert response.status_code == 503
    assert response.json()["error_code"] == "GOOGLE_OAUTH_NOT_CONFIGURED"


def test_google_callback_rejects_invalid_state(auth_client, monkeypatch):
    client, _ = auth_client
    monkeypatch.setattr("app.api.v1.auth.get_settings", google_settings)

    response = client.get(
        "/api/v1/auth/google/callback?code=abc&state=wrong",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert response.headers["location"].endswith("/login?google_error=invalid_state")


def test_google_callback_handles_denied_consent_without_validation_error(auth_client, monkeypatch):
    client, _ = auth_client
    monkeypatch.setattr("app.api.v1.auth.get_settings", google_settings)
    client.cookies.set("mediamind_google_state", "expected", path="/api/v1/auth/google")

    response = client.get(
        "/api/v1/auth/google/callback?error=access_denied&state=expected",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert response.headers["location"].endswith("/login?google_error=access_denied")
    assert "mediamind_google_state=" in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]


def test_google_callback_handles_missing_configuration_without_server_error(
    auth_client, monkeypatch
):
    client, _ = auth_client
    settings = google_settings()
    settings.google_client_secret = None
    monkeypatch.setattr("app.api.v1.auth.get_settings", lambda: settings)
    client.cookies.set("mediamind_google_state", "expected", path="/api/v1/auth/google")

    response = client.get(
        "/api/v1/auth/google/callback?code=abc&state=expected",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert response.headers["location"].endswith("/login?google_error=not_configured")
    assert "mediamind_google_state=" in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]


def test_google_callback_rejects_missing_authorization_code(auth_client, monkeypatch):
    client, _ = auth_client
    monkeypatch.setattr("app.api.v1.auth.get_settings", google_settings)
    monkeypatch.setattr(
        "app.api.v1.auth.exchange_google_code",
        AsyncMock(return_value={"email": "alexmacielferreira@gmail.com", "email_verified": True}),
    )
    client.cookies.set("mediamind_google_state", "expected", path="/api/v1/auth/google")

    response = client.get(
        "/api/v1/auth/google/callback?state=expected",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert response.headers["location"].endswith("/login?google_error=provider_failed")
    assert "mediamind_session=" not in response.headers.get("set-cookie", "")


@pytest.mark.parametrize(
    "provider_error", [KeyError("access_token"), __import__("httpx").ConnectError("offline")]
)
def test_google_callback_handles_provider_failure(auth_client, monkeypatch, provider_error):
    client, _ = auth_client
    monkeypatch.setattr("app.api.v1.auth.get_settings", google_settings)
    monkeypatch.setattr(
        "app.api.v1.auth.exchange_google_code", AsyncMock(side_effect=provider_error)
    )
    client.cookies.set("mediamind_google_state", "expected", path="/api/v1/auth/google")

    response = client.get(
        "/api/v1/auth/google/callback?code=abc&state=expected",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert response.headers["location"].endswith("/login?google_error=provider_failed")


def test_google_callback_rejects_unverified_or_inactive_account(auth_client, monkeypatch):
    client, testing_session = auth_client
    monkeypatch.setattr("app.api.v1.auth.get_settings", google_settings)
    exchange = AsyncMock(
        return_value={"email": "alexmacielferreira@gmail.com", "email_verified": False}
    )
    monkeypatch.setattr("app.api.v1.auth.exchange_google_code", exchange)
    client.cookies.set("mediamind_google_state", "expected", path="/api/v1/auth/google")
    unverified = client.get(
        "/api/v1/auth/google/callback?code=abc&state=expected", follow_redirects=False
    )
    assert unverified.headers["location"].endswith("/login?google_error=account_not_allowed")

    with testing_session() as session:
        user = session.query(User).filter_by(email_normalized="alexmacielferreira@gmail.com").one()
        user.is_active = False
        session.commit()
    exchange.return_value = {"email": "alexmacielferreira@gmail.com", "email_verified": True}
    client.cookies.set("mediamind_google_state", "expected", path="/api/v1/auth/google")
    inactive = client.get(
        "/api/v1/auth/google/callback?code=abc&state=expected", follow_redirects=False
    )
    assert inactive.headers["location"].endswith("/login?google_error=account_not_allowed")


def test_google_callback_rejects_account_without_active_membership(auth_client, monkeypatch):
    client, testing_session = auth_client
    monkeypatch.setattr("app.api.v1.auth.get_settings", google_settings)
    monkeypatch.setattr(
        "app.api.v1.auth.exchange_google_code",
        AsyncMock(return_value={"email": "alexmacielferreira@gmail.com", "email_verified": True}),
    )
    with testing_session() as session:
        membership = session.query(Membership).one()
        membership.is_active = False
        session.commit()
    client.cookies.set("mediamind_google_state", "expected", path="/api/v1/auth/google")

    response = client.get(
        "/api/v1/auth/google/callback?code=abc&state=expected",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert response.headers["location"].endswith("/login?google_error=account_not_allowed")
    assert "mediamind_session=" not in response.headers.get("set-cookie", "")


def test_google_exchange_posts_code_and_loads_verified_profile(monkeypatch):
    from app.services.google_oauth import exchange_google_code

    token_response = MagicMock()
    token_response.json.return_value = {"access_token": "access-token"}
    user_response = MagicMock()
    user_response.json.return_value = {
        "email": "alexmacielferreira@gmail.com",
        "email_verified": True,
    }
    client = AsyncMock()
    client.post.return_value = token_response
    client.get.return_value = user_response
    context = AsyncMock()
    context.__aenter__.return_value = client
    monkeypatch.setattr(
        "app.services.google_oauth.httpx.AsyncClient", MagicMock(return_value=context)
    )

    profile = asyncio.run(
        exchange_google_code(
            code="code", client_id="client", client_secret="secret", redirect_uri="callback"
        )
    )

    assert profile["email_verified"] is True
    token_response.raise_for_status.assert_called_once()
    user_response.raise_for_status.assert_called_once()
    client.post.assert_awaited_once()
    client.get.assert_awaited_once_with(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": "Bearer access-token"},
    )

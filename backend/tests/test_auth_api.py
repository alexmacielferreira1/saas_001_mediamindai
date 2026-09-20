from datetime import UTC, datetime, timedelta

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

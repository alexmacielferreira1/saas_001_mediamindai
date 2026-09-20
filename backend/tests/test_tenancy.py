from uuid import uuid4

import pytest
from app.db.session import Base, get_session
from app.main import create_app
from app.models.identity import Membership, Tenant, User
from app.security.passwords import hash_password
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

PASSWORD = "senha-local-segura"


@pytest.fixture
def tenant_client():
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
        primary = Tenant(name="Empresa Principal", slug="empresa-principal")
        secondary = Tenant(name="Empresa Secundária", slug="empresa-secundaria")
        inactive = Tenant(name="Empresa Inativa", slug="empresa-inativa", is_active=False)
        session.add_all([user, primary, secondary, inactive])
        session.flush()
        session.add_all(
            [
                Membership(user_id=user.id, tenant_id=primary.id, role="superadmin"),
                Membership(user_id=user.id, tenant_id=secondary.id, role="editor"),
                Membership(user_id=user.id, tenant_id=inactive.id, role="admin"),
            ]
        )
        session.commit()
        ids = {
            "primary": primary.id,
            "secondary": secondary.id,
            "inactive": inactive.id,
            "user": user.id,
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


def sign_in(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "alexmacielferreira@gmail.com", "password": PASSWORD},
    )
    assert response.status_code == 200


def test_tenants_require_authentication(tenant_client):
    client, _ = tenant_client
    response = client.get("/api/v1/tenants")

    assert response.status_code == 401
    assert response.json()["error_code"] == "AUTHENTICATION_REQUIRED"


def test_tenants_list_only_active_memberships_and_tenants(tenant_client):
    client, ids = tenant_client
    sign_in(client)

    response = client.get("/api/v1/tenants")
    assert response.status_code == 200
    assert response.json() == {
        "tenants": [
            {"id": str(ids["primary"]), "name": "Empresa Principal", "role": "superadmin"},
            {"id": str(ids["secondary"]), "name": "Empresa Secundária", "role": "editor"},
        ]
    }


def test_existing_session_is_rejected_after_user_is_deactivated(tenant_client):
    client, ids = tenant_client
    sign_in(client)
    with ids["session_factory"]() as session:
        session.get(User, ids["user"]).is_active = False
        session.commit()

    response = client.get("/api/v1/auth/session")

    assert response.status_code == 401
    assert response.json()["error_code"] == "AUTHENTICATION_REQUIRED"


def test_switch_tenant_persists_only_an_active_membership(tenant_client):
    client, ids = tenant_client
    sign_in(client)

    response = client.put("/api/v1/auth/session/tenant", json={"tenant_id": str(ids["secondary"])})
    assert response.status_code == 200
    assert response.json()["selected_tenant_id"] == str(ids["secondary"])
    assert client.get("/api/v1/auth/session").json()["selected_tenant_id"] == str(ids["secondary"])


@pytest.mark.parametrize("target", ["inactive", "unknown"])
def test_switch_tenant_rejects_inactive_or_forged_membership(tenant_client, target):
    client, ids = tenant_client
    sign_in(client)
    tenant_id = ids["inactive"] if target == "inactive" else uuid4()

    response = client.put("/api/v1/auth/session/tenant", json={"tenant_id": str(tenant_id)})
    assert response.status_code == 403
    assert response.json()["error_code"] == "TENANT_ACCESS_DENIED"


def test_role_guard_denies_a_role_outside_the_allowlist():
    from app.tenancy.context import CurrentSession, require_role

    current = CurrentSession(auth_session=None, user=None, membership=None, tenant=None)
    current.membership = type("Membership", (), {"role": "viewer"})()

    with pytest.raises(HTTPException) as exc:
        require_role(current, {"admin", "superadmin"})
    assert exc.value.status_code == 403


def test_role_guard_requires_a_selected_tenant_membership():
    from app.core.errors import PublicError
    from app.tenancy.context import CurrentSession, require_role

    current = CurrentSession(auth_session=None, user=None, membership=None, tenant=None)

    with pytest.raises(PublicError) as exc:
        require_role(current, {"admin", "superadmin"})
    assert exc.value.status == 403
    assert exc.value.code == "TENANT_ACCESS_DENIED"


def test_role_guard_accepts_an_allowed_role():
    from app.tenancy.context import CurrentSession, require_role

    current = CurrentSession(auth_session=None, user=None, membership=None, tenant=None)
    current.membership = type("Membership", (), {"role": "admin"})()

    assert require_role(current, {"admin", "superadmin"}) is current

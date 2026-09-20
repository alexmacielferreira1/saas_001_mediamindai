import pytest
from app.db.session import Base
from app.demo_accounts import DEMO_ACCOUNTS
from app.models.identity import Membership, Permission, PermissionGroup, Tenant, User
from app.security.passwords import verify_password
from app.services.demo_seed import seed_demo_accounts
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session


@pytest.fixture
def db_session():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_seed_creates_all_local_demo_users_with_alex_as_superadmin(db_session):
    result = seed_demo_accounts(db_session, "senha-demo-local-segura", "local")

    users = db_session.scalars(select(User).order_by(User.email)).all()
    memberships = db_session.scalars(select(Membership)).all()
    tenant = db_session.scalar(select(Tenant))

    assert result == {"created": len(DEMO_ACCOUNTS), "updated": 0, "tenant_id": str(tenant.id)}
    assert len(users) == len(DEMO_ACCOUNTS)
    assert len(memberships) == len(DEMO_ACCOUNTS)
    alex = next(user for user in users if user.email == "alexmacielferreira@gmail.com")
    alex_membership = next(item for item in memberships if item.user_id == alex.id)
    assert alex_membership.role == "superadmin"
    assert all(verify_password("senha-demo-local-segura", user.password_hash) for user in users)


def test_seed_is_idempotent_and_refreshes_existing_local_accounts(db_session):
    seed_demo_accounts(db_session, "primeira-senha-segura", "test")
    result = seed_demo_accounts(db_session, "segunda-senha-segura", "test")

    users = db_session.scalars(select(User)).all()
    assert result["created"] == 0
    assert result["updated"] == len(DEMO_ACCOUNTS)
    assert len(users) == len(DEMO_ACCOUNTS)
    assert all(verify_password("segunda-senha-segura", user.password_hash) for user in users)


def test_seed_creates_idempotent_permission_bootstrap_for_administrators(db_session):
    seed_demo_accounts(db_session, "senha-demo-local-segura", "local")
    seed_demo_accounts(db_session, "senha-demo-local-segura", "local")

    permissions = db_session.scalars(select(Permission)).all()
    groups = db_session.scalars(select(PermissionGroup)).all()
    memberships = db_session.scalars(select(Membership)).all()

    assert sorted(item.code for item in permissions) == [
        "permissions.manage",
        "users.manage",
        "users.manage_admin",
    ]
    assert [item.name for item in groups] == [
        "Administradores de permissões",
        "Gestores CEDOC",
    ]
    admin_group, cedoc_group = groups
    assert sorted(item.code for item in admin_group.permissions) == [
        "permissions.manage",
        "users.manage",
        "users.manage_admin",
    ]
    assert sorted(item.code for item in cedoc_group.permissions) == [
        "permissions.manage",
        "users.manage",
    ]
    admin_roles = {item.role for item in memberships if item.permission_group_id == admin_group.id}
    cedoc_roles = {item.role for item in memberships if item.permission_group_id == cedoc_group.id}
    assert admin_roles == {"admin", "superadmin"}
    assert cedoc_roles == {"cedoc"}
    assert all(
        item.permission_group_id is None
        for item in memberships
        if item.role not in {"admin", "cedoc", "superadmin"}
    )


@pytest.mark.parametrize("environment", ["production", "staging", ""])
def test_seed_refuses_every_environment_except_local_and_test(db_session, environment):
    with pytest.raises(RuntimeError, match="somente em local/test"):
        seed_demo_accounts(db_session, "senha-demo-local-segura", environment)

    assert db_session.scalar(select(User)) is None


@pytest.mark.parametrize("password", ["", "curta"])
def test_seed_rejects_a_missing_or_weak_demo_password(db_session, password):
    with pytest.raises(ValueError, match="pelo menos 12 caracteres"):
        seed_demo_accounts(db_session, password, "local")

    assert db_session.scalar(select(User)) is None

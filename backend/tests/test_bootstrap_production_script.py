import importlib.util
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from app.db.session import Base
from app.models.identity import Membership, Permission, PermissionGroup, User
from app.security.passwords import verify_password
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "bootstrap_production.py"
FIRST = "senha-inicial-segura-123"
SECOND = "senha-nova-do-deploy-456"


def load_script():
    spec = importlib.util.spec_from_file_location("bootstrap_production", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def bootstrap(monkeypatch):
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setenv("BOOTSTRAP_ADMIN_EMAIL", "Admin@MediaMind.ai")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_NAME", "Admin")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", FIRST)
    module = load_script()
    yield module, factory, monkeypatch
    Base.metadata.drop_all(engine)
    engine.dispose()


def admin(factory):
    with factory() as session:
        return session.scalar(select(User).where(User.email_normalized == "admin@mediamind.ai"))


def test_first_run_creates_superadmin_with_configured_password(bootstrap):
    module, factory, _ = bootstrap

    module.main([], session_factory=factory)

    user = admin(factory)
    assert verify_password(FIRST, user.password_hash)
    with factory() as session:
        membership = session.scalar(select(Membership).where(Membership.user_id == user.id))
        assert membership.role == "superadmin"


def test_rerun_does_not_reset_password_or_unlock_by_default(bootstrap):
    module, factory, monkeypatch = bootstrap
    module.main([], session_factory=factory)
    locked = datetime.now(UTC) + timedelta(minutes=10)
    with factory() as session:
        user = session.scalar(select(User))
        user.failed_login_attempts = 4
        user.locked_until = locked
        session.commit()
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", SECOND)

    module.main([], session_factory=factory)

    user = admin(factory)
    assert verify_password(FIRST, user.password_hash)
    assert not verify_password(SECOND, user.password_hash)
    assert user.failed_login_attempts == 4
    assert user.locked_until is not None


def test_rerun_without_password_env_keeps_existing_admin(bootstrap):
    module, factory, monkeypatch = bootstrap
    module.main([], session_factory=factory)
    monkeypatch.delenv("BOOTSTRAP_ADMIN_PASSWORD")

    module.main([], session_factory=factory)

    assert verify_password(FIRST, admin(factory).password_hash)


def test_explicit_flag_resets_password_and_unlocks(bootstrap):
    module, factory, monkeypatch = bootstrap
    module.main([], session_factory=factory)
    with factory() as session:
        user = session.scalar(select(User))
        user.failed_login_attempts = 5
        user.locked_until = datetime.now(UTC) + timedelta(minutes=10)
        session.commit()
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", SECOND)

    module.main(["--reset-superadmin-password"], session_factory=factory)

    user = admin(factory)
    assert verify_password(SECOND, user.password_hash)
    assert user.failed_login_attempts == 0
    assert user.locked_until is None


def test_creation_requires_a_strong_password(bootstrap):
    module, factory, monkeypatch = bootstrap
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", "curta")

    with pytest.raises(SystemExit, match="12 caracteres"):
        module.main([], session_factory=factory)

    assert admin(factory) is None


def test_reset_flag_rejects_weak_password_before_touching_the_database(bootstrap):
    module, factory, monkeypatch = bootstrap
    module.main([], session_factory=factory)
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", "curta")

    with pytest.raises(SystemExit):
        module.main(["--reset-superadmin-password"], session_factory=factory)

    assert verify_password(FIRST, admin(factory).password_hash)


def test_rerun_preserves_extra_permissions_granted_to_admin_group(bootstrap):
    module, factory, _ = bootstrap
    module.main([], session_factory=factory)
    with factory() as session:
        extra = Permission(code="assets.write", description="Ativos")
        session.add(extra)
        group = session.scalar(select(PermissionGroup))
        group.permissions.append(extra)
        session.commit()

    module.main([], session_factory=factory)

    with factory() as session:
        group = session.scalar(select(PermissionGroup))
        codes = {permission.code for permission in group.permissions}
    assert {"assets.write", "permissions.manage", "users.manage"} <= codes


def suspend(factory, *, user=True, membership=True):
    with factory() as session:
        if user:
            session.scalar(select(User)).is_active = False
        if membership:
            session.scalar(select(Membership)).is_active = False
        session.commit()


def state(factory):
    with factory() as session:
        return session.scalar(select(User)).is_active, session.scalar(select(Membership)).is_active


@pytest.mark.parametrize(
    ("user", "membership"), [(True, True), (True, False), (False, True)], ids=str
)
def test_rerun_keeps_suspended_superadmin_suspended(bootstrap, capsys, user, membership):
    module, factory, _ = bootstrap
    module.main([], session_factory=factory)
    suspend(factory, user=user, membership=membership)

    module.main([], session_factory=factory)

    assert state(factory) == (not user, not membership)
    assert "suspenso" in capsys.readouterr().out


def test_reactivate_flag_restores_suspended_superadmin_without_touching_password(bootstrap):
    module, factory, monkeypatch = bootstrap
    module.main([], session_factory=factory)
    suspend(factory)
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", SECOND)

    module.main(["--reactivate-superadmin"], session_factory=factory)

    assert state(factory) == (True, True)
    assert verify_password(FIRST, admin(factory).password_hash)


def legacy_suspend(factory):
    with factory() as session:
        session.scalar(select(User)).account_status = "suspended"
        session.commit()


def test_rerun_keeps_legacy_account_suspension(bootstrap, capsys):
    module, factory, _ = bootstrap
    module.main([], session_factory=factory)
    legacy_suspend(factory)

    module.main([], session_factory=factory)

    assert admin(factory).account_status == "suspended"
    assert "suspenso" in capsys.readouterr().out


@pytest.mark.parametrize("flag", ["--reactivate-superadmin", "--reset-superadmin-password"])
def test_reactivation_also_clears_legacy_account_suspension(bootstrap, flag):
    module, factory, _ = bootstrap
    module.main([], session_factory=factory)
    legacy_suspend(factory)
    suspend(factory, user=False)

    module.main([flag], session_factory=factory)

    assert admin(factory).account_status == "active"
    assert state(factory) == (True, True)


def test_reactivation_keeps_other_account_statuses(bootstrap):
    module, factory, _ = bootstrap
    module.main([], session_factory=factory)
    with factory() as session:
        session.scalar(select(User)).account_status = "pending"
        session.commit()

    module.main(["--reactivate-superadmin"], session_factory=factory)

    assert admin(factory).account_status == "pending"


def test_password_reset_flag_also_reactivates(bootstrap):
    module, factory, monkeypatch = bootstrap
    module.main([], session_factory=factory)
    suspend(factory)
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", SECOND)

    module.main(["--reset-superadmin-password"], session_factory=factory)

    assert state(factory) == (True, True)
    assert verify_password(SECOND, admin(factory).password_hash)

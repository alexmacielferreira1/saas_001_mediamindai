from datetime import UTC, datetime, timedelta

import pytest
from app.db.session import Base
from app.models.identity import AuthSession, Membership, Tenant, User
from app.security.passwords import hash_password, verify_password
from app.security.sessions import hash_session_token, new_session_token
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def test_password_hash_does_not_contain_or_accept_the_wrong_password():
    encoded = hash_password("uma-senha-longa-e-unica")

    assert "uma-senha-longa-e-unica" not in encoded
    assert encoded.startswith("scrypt$")
    assert verify_password("uma-senha-longa-e-unica", encoded) is True
    assert verify_password("senha-incorreta", encoded) is False


def test_password_verification_rejects_malformed_hashes():
    assert verify_password("qualquer", "") is False
    assert verify_password("qualquer", "scrypt$incompleto") is False
    assert verify_password("qualquer", "algoritmo-desconhecido$1$2$3") is False
    assert verify_password("qualquer", "argon2$1$2$3$00$00") is False


def test_empty_password_is_rejected_before_hashing():
    with pytest.raises(ValueError, match="must not be empty"):
        hash_password("")


def test_session_tokens_are_random_and_only_the_hash_is_stable():
    first = new_session_token()
    second = new_session_token()

    assert first != second
    assert len(first) >= 43
    assert hash_session_token(first) == hash_session_token(first)
    assert hash_session_token(first) != hash_session_token(second)
    assert first not in hash_session_token(first)


def test_session_expiration_boundary_is_utc_aware():
    now = datetime.now(UTC)
    expires_at = now + timedelta(hours=8)

    assert expires_at.tzinfo is UTC
    assert expires_at > now


@pytest.fixture
def db_session():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def test_normalized_email_is_unique(db_session):
    db_session.add(
        User(email="Pessoa@Example.com", email_normalized="pessoa@example.com", password_hash="x")
    )
    db_session.commit()
    db_session.add(
        User(email="pessoa@example.com", email_normalized="pessoa@example.com", password_hash="y")
    )

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_membership_and_session_keep_tenant_selection_explicit(db_session):
    user = User(email="admin@example.com", email_normalized="admin@example.com", password_hash="x")
    tenant = Tenant(name="Empresa Local", slug="empresa-local")
    db_session.add_all([user, tenant])
    db_session.flush()
    membership = Membership(user_id=user.id, tenant_id=tenant.id, role="admin")
    auth_session = AuthSession(
        user_id=user.id,
        token_hash=hash_session_token(new_session_token()),
        selected_tenant_id=tenant.id,
        expires_at=datetime.now(UTC) + timedelta(hours=8),
    )
    db_session.add_all([membership, auth_session])
    db_session.commit()

    stored = db_session.scalar(select(AuthSession))
    assert stored.selected_tenant_id == tenant.id
    assert stored.is_active(datetime.now(UTC)) is True
    stored.revoked_at = datetime.now(UTC)
    assert stored.is_active(datetime.now(UTC)) is False


def test_expired_session_and_naive_database_timestamp_are_handled():
    now = datetime.now(UTC)
    auth_session = AuthSession(
        user_id=None,
        token_hash="a" * 64,
        expires_at=(now - timedelta(seconds=1)).replace(tzinfo=None),
    )

    assert auth_session.is_active(now) is False


def test_aware_future_session_is_active_without_timestamp_conversion():
    now = datetime.now(UTC)
    auth_session = AuthSession(
        user_id=None,
        token_hash="b" * 64,
        expires_at=now + timedelta(minutes=1),
    )

    assert auth_session.is_active(now) is True

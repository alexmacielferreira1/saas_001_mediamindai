from datetime import UTC, datetime, timedelta

import pytest
from app.db.session import Base
from app.models.identity import User
from app.security.passwords import hash_password
from app.services.auth import authenticate
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


@pytest.fixture
def session():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(
            User(
                email="alvo@example.com",
                email_normalized="alvo@example.com",
                password_hash=hash_password("senha-correta"),
            )
        )
        db.commit()
        yield db
    engine.dispose()


def login(session, password, now):
    return authenticate(
        session,
        "alvo@example.com",
        password,
        session_hours=8,
        max_attempts=3,
        lockout_minutes=15,
        now=now,
    )


def test_account_locks_at_threshold_and_keeps_generic_failure(session):
    now = datetime(2026, 9, 19, 12, tzinfo=UTC)
    assert login(session, "errada", now) is None
    assert login(session, "errada", now) is None
    assert login(session, "errada", now) is None
    assert login(session, "senha-correta", now) is None
    user = session.query(User).one()
    assert user.failed_login_attempts == 3
    assert user.locked_until.replace(tzinfo=UTC) == now + timedelta(minutes=15)


def test_success_resets_failures_before_threshold(session):
    now = datetime(2026, 9, 19, 12, tzinfo=UTC)
    assert login(session, "errada", now) is None
    assert login(session, "senha-correta", now) is not None
    user = session.query(User).one()
    assert user.failed_login_attempts == 0
    assert user.locked_until is None


def test_login_succeeds_after_lockout_window(session):
    now = datetime(2026, 9, 19, 12, tzinfo=UTC)
    for _ in range(3):
        login(session, "errada", now)

    assert login(session, "senha-correta", now + timedelta(minutes=16)) is not None

import os
from datetime import UTC, datetime, timedelta

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from app.db.session import engine
from app.models.identity import AuthSession, Membership, Tenant, User
from app.security.sessions import hash_session_token, new_session_token
from sqlalchemy import text
from sqlalchemy.orm import Session

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.environ.get("HUB_INTEGRATION") != "1",
        reason="Set HUB_INTEGRATION=1 for local PostgreSQL",
    ),
]


def test_database_and_migration_revision():
    expected_head = ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
    with engine.connect() as connection:
        assert connection.scalar(text("select 1")) == 1
        assert connection.scalar(text("select version_num from alembic_version")) == expected_head


def test_identity_records_round_trip_in_postgresql():
    with engine.connect() as connection, connection.begin() as transaction:
        session = Session(bind=connection, expire_on_commit=False)
        user = User(
            email="integration@example.com",
            email_normalized="integration@example.com",
            password_hash="not-a-real-login-hash",
        )
        tenant = Tenant(name="Integração", slug="integracao-test")
        session.add_all([user, tenant])
        session.flush()
        session.add_all(
            [
                Membership(user_id=user.id, tenant_id=tenant.id, role="admin"),
                AuthSession(
                    user_id=user.id,
                    token_hash=hash_session_token(new_session_token()),
                    selected_tenant_id=tenant.id,
                    expires_at=datetime.now(UTC) + timedelta(minutes=5),
                ),
            ]
        )
        session.flush()

        assert session.query(User).filter_by(email_normalized="integration@example.com").one().id
        assert session.query(Membership).filter_by(tenant_id=tenant.id).one().role == "admin"
        assert (
            session.query(AuthSession).filter_by(user_id=user.id).one().selected_tenant_id
            == tenant.id
        )

        session.close()
        transaction.rollback()

import os

import pytest
from app.db.session import engine
from sqlalchemy import text

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.environ.get("HUB_INTEGRATION") != "1",
        reason="Set HUB_INTEGRATION=1 for local PostgreSQL",
    ),
]


def test_database_and_migration_revision():
    with engine.connect() as connection:
        assert connection.scalar(text("select 1")) == 1
        assert (
            connection.scalar(text("select version_num from alembic_version")) == "0001_bootstrap"
        )

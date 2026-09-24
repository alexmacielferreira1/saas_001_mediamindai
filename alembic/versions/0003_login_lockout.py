"""Add per-account login lockout state."""

import sqlalchemy as sa

from alembic import op

revision = "0003_login_lockout"
down_revision = "0002_identity_tenancy"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")

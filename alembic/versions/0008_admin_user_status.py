"""add administrative user lifecycle status

Revision ID: 0008_admin_user_status
Revises: 0007_hub_commands
"""

from alembic import op
import sqlalchemy as sa

revision = "0008_admin_user_status"
down_revision = "0007_hub_commands"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("account_status", sa.String(length=32), nullable=False, server_default="active"),
    )
    op.create_index("ix_users_account_status", "users", ["account_status"])


def downgrade() -> None:
    op.drop_index("ix_users_account_status", table_name="users")
    op.drop_column("users", "account_status")

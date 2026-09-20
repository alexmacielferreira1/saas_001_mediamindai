"""Add tenant-scoped permission groups.

Revision ID: 0004_permission_groups
Revises: 0003_login_lockout
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_permission_groups"
down_revision: str | None = "0003_login_lockout"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "permissions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=160), nullable=False),
        sa.Column("description", sa.String(length=300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_permissions_code", "permissions", ["code"], unique=True)
    op.create_table(
        "permission_groups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=300), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "name", name="uq_permission_group_tenant_name"),
    )
    op.create_index(
        "ix_permission_groups_tenant_id", "permission_groups", ["tenant_id"], unique=False
    )
    op.create_table(
        "permission_group_permissions",
        sa.Column("permission_group_id", sa.Uuid(), nullable=False),
        sa.Column("permission_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["permission_group_id"], ["permission_groups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("permission_group_id", "permission_id"),
    )
    op.add_column("memberships", sa.Column("permission_group_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_memberships_permission_group_id",
        "memberships",
        "permission_groups",
        ["permission_group_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_memberships_permission_group_id",
        "memberships",
        ["permission_group_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_memberships_permission_group_id", table_name="memberships")
    op.drop_constraint("fk_memberships_permission_group_id", "memberships", type_="foreignkey")
    op.drop_column("memberships", "permission_group_id")
    op.drop_table("permission_group_permissions")
    op.drop_index("ix_permission_groups_tenant_id", table_name="permission_groups")
    op.drop_table("permission_groups")
    op.drop_index("ix_permissions_code", table_name="permissions")
    op.drop_table("permissions")

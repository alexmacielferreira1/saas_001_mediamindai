"""add tenant-scoped local records

Revision ID: 0006_tenant_records
Revises: 0005_membership_screen_overrides
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_tenant_records"
down_revision = "0005_membership_screen_overrides"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "tenant_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tenant_records_tenant_id", "tenant_records", ["tenant_id"])
    op.create_index("ix_tenant_records_entity_type", "tenant_records", ["entity_type"])


def downgrade():
    op.drop_index("ix_tenant_records_entity_type", table_name="tenant_records")
    op.drop_index("ix_tenant_records_tenant_id", table_name="tenant_records")
    op.drop_table("tenant_records")

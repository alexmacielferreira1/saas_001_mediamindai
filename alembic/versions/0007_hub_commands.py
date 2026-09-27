"""add idempotent HUB command inbox

Revision ID: 0007_hub_commands
Revises: 0006_tenant_records
"""

import sqlalchemy as sa

from alembic import op

revision = "0007_hub_commands"
down_revision = "0006_tenant_records"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "hub_commands",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_service", sa.String(length=120), nullable=False),
        sa.Column("idempotency_key", sa.String(length=200), nullable=False),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("dry_run", sa.Boolean(), nullable=False),
        sa.Column("parameters", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("correlation_id", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_service",
            "idempotency_key",
            name="uq_hub_command_source_idempotency",
        ),
    )
    op.create_index("ix_hub_commands_source_service", "hub_commands", ["source_service"])
    op.create_index("ix_hub_commands_action", "hub_commands", ["action"])
    op.create_index("ix_hub_commands_status", "hub_commands", ["status"])
    op.create_index("ix_hub_commands_correlation_id", "hub_commands", ["correlation_id"])


def downgrade():
    op.drop_index("ix_hub_commands_correlation_id", table_name="hub_commands")
    op.drop_index("ix_hub_commands_status", table_name="hub_commands")
    op.drop_index("ix_hub_commands_action", table_name="hub_commands")
    op.drop_index("ix_hub_commands_source_service", table_name="hub_commands")
    op.drop_table("hub_commands")

"""persist membership screen overrides

Revision ID: 0005_membership_screen_overrides
Revises: 0004_permission_groups
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_membership_screen_overrides"
down_revision = "0004_permission_groups"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("memberships", sa.Column("extra_screens", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("memberships", sa.Column("restricted_screens", sa.JSON(), nullable=False, server_default="[]"))


def downgrade():
    op.drop_column("memberships", "restricted_screens")
    op.drop_column("memberships", "extra_screens")

"""add composite listing index on tenant records

Revision ID: 0009_tenant_records_list_index
Revises: 0008_admin_user_status

Só cria índice (não destrutivo). Atende às consultas por empresa + entidade ordenadas por
data (dashboard, Gestão, /records). Auditoria 2026-10-23, achado #8. Em PostgreSQL o índice
é criado com CONCURRENTLY, sem bloquear escritas em tenant_records.
"""

from alembic import op

revision = "0009_tenant_records_list_index"
down_revision = "0008_admin_user_status"
branch_labels = None
depends_on = None

INDEX_NAME = "ix_tenant_records_tenant_entity_created"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            INDEX_NAME,
            "tenant_records",
            ["tenant_id", "entity_type", "created_at"],
            postgresql_concurrently=True,
            if_not_exists=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX_NAME,
            table_name="tenant_records",
            postgresql_concurrently=True,
            if_exists=True,
        )

"""create the permission catalog and default permission groups

Revision ID: 0010_default_permission_groups
Revises: 0009_tenant_records_list_index

Em produção só existiam permissions.manage, users.manage e users.manage_admin (criadas pelo
bootstrap). Os códigos de conteúdo (assets.write, clips.write, production.write,
publishing.write, review.write) existiam só no seed local, então nenhum grupo podia recebê-los
e qualquer gravação de conteúdo devolvia 403 no site publicado (auditoria local × produção de
2026-10-27). Esta migration de dados, idempotente:

1. cria os 8 códigos do catálogo que faltarem;
2. em cada empresa, cria os grupos-padrão que faltarem (mesmos do seed local) e acrescenta ao
   grupo "Administradores de permissões" os códigos que faltarem, sem remover nada;
3. vincula ao grupo-padrão do cargo só os vínculos SEM grupo. Quem já tem grupo continua igual.
   Cargos fora da lista reconhecida (viewer, legados) continuam sem grupo. Grupos da empresa com
   o mesmo nome de um padrão (ou inativos) não são alterados nem recebem vínculos.

downgrade: desvincula e apaga só os grupos que esta migration criou (marcados na descrição).
Os códigos do catálogo e os códigos acrescentados a grupos que já existiam permanecem, porque
grupos criados depois por um administrador podem depender deles.
"""

from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa

from alembic import op

revision = "0010_default_permission_groups"
down_revision = "0009_tenant_records_list_index"
branch_labels = None
depends_on = None

# Cópia fixa do catálogo (migrations não importam código da aplicação, que muda com o tempo).
CATALOG = {
    "assets.write": "Criar e alterar ativos, direitos, transcrições e arquivos",
    "clips.write": "Criar e alterar cortes e versões",
    "production.write": "Criar e alterar produções, agenda, briefings e pendências",
    "publishing.write": "Programar, publicar e acompanhar distribuição",
    "review.write": "Comentar, revisar e aprovar conteúdo",
    "permissions.manage": "Gerenciar grupos e atribuições de permissões",
    "users.manage": "Gerenciar vínculos e cargos de usuários",
    "users.manage_admin": "Conceder cargos administrativos",
}
CONTENT = ("assets.write", "clips.write", "production.write", "publishing.write", "review.write")
MARKER = "[padrão 0010]"
ADMIN_GROUP = "Administradores de permissões"
CEDOC_GROUP = "Gestores CEDOC"
CONTENT_GROUP = "Operadores de conteúdo"
GROUPS = (
    (
        ADMIN_GROUP,
        "Administração completa da empresa",
        (*CONTENT, "permissions.manage", "users.manage", "users.manage_admin"),
    ),
    (
        CEDOC_GROUP,
        "Gestão do acervo e de usuários sem promoção administrativa",
        ("assets.write", "permissions.manage", "users.manage"),
    ),
    (CONTENT_GROUP, "Produção, edição, revisão e publicação de conteúdo", CONTENT),
)
ADMIN_ROLES = {"admin", "superadmin"}
# Cargos reconhecidos (memberships.ALLOWED_ROLES em 2026-10-27) que produzem conteúdo.
# Cargo fora da lista (viewer, legado ou desconhecido) continua sem grupo: só leitura.
CONTENT_ROLES = {
    "apresentador", "assessoria", "audiovisual", "cenografo", "coordenador_comunicacao",
    "design", "diretor_programa", "documentacao", "editor", "endomarketing", "estagiario",
    "fotografo", "gestao", "journalist", "juridico", "locutor", "motion_designer", "mvp",
    "producer", "produtor_reportagem", "programacao", "qualidade", "reporter", "revisor",
    "revistas", "roteirista", "social_media", "sonoplasta", "ti_suporte", "tradutor", "videomaker",
}  # fmt: skip

metadata = sa.MetaData()
tenants = sa.Table("tenants", metadata, sa.Column("id", sa.Uuid()))
permissions = sa.Table(
    "permissions",
    metadata,
    sa.Column("id", sa.Uuid()),
    sa.Column("code", sa.String(160)),
    sa.Column("description", sa.String(300)),
    sa.Column("created_at", sa.DateTime(timezone=True)),
)
groups = sa.Table(
    "permission_groups",
    metadata,
    sa.Column("id", sa.Uuid()),
    sa.Column("tenant_id", sa.Uuid()),
    sa.Column("name", sa.String(120)),
    sa.Column("description", sa.String(300)),
    sa.Column("is_active", sa.Boolean()),
    sa.Column("created_at", sa.DateTime(timezone=True)),
    sa.Column("updated_at", sa.DateTime(timezone=True)),
)
links = sa.Table(
    "permission_group_permissions",
    metadata,
    sa.Column("permission_group_id", sa.Uuid()),
    sa.Column("permission_id", sa.Uuid()),
)
memberships = sa.Table(
    "memberships",
    metadata,
    sa.Column("id", sa.Uuid()),
    sa.Column("tenant_id", sa.Uuid()),
    sa.Column("role", sa.String(80)),
    sa.Column("permission_group_id", sa.Uuid()),
)


def default_group_for(role: str) -> str | None:
    if role in ADMIN_ROLES:
        return ADMIN_GROUP
    if role == "cedoc":
        return CEDOC_GROUP
    if role in CONTENT_ROLES:
        return CONTENT_GROUP
    return None


def apply_defaults(connection) -> None:
    now = datetime.now(UTC)
    permission_ids = {
        code: pid
        for pid, code in connection.execute(sa.select(permissions.c.id, permissions.c.code))
    }
    for code, description in CATALOG.items():
        if code not in permission_ids:
            permission_ids[code] = uuid4()
            connection.execute(
                permissions.insert().values(
                    id=permission_ids[code], code=code, description=description, created_at=now
                )
            )

    for (tenant_id,) in connection.execute(sa.select(tenants.c.id)).all():
        # Só recebem vínculos os grupos desta migration (novos ou de uma execução anterior) e o
        # grupo de administradores ativo (o do bootstrap). Um grupo com o mesmo nome criado pela
        # empresa, ou inativo, não é alterado nem recebe ninguém: poderia ter outros códigos.
        group_ids = {}
        for name, description, codes in GROUPS:
            found = connection.execute(
                sa.select(groups.c.id, groups.c.is_active, groups.c.description).where(
                    groups.c.tenant_id == tenant_id, groups.c.name == name
                )
            ).first()
            if found is not None:
                ours = (found.description or "").endswith(MARKER)
                if not ours and not (name == ADMIN_GROUP and found.is_active):
                    continue
                group_id = found.id
            else:
                group_id = uuid4()
                connection.execute(
                    groups.insert().values(
                        id=group_id,
                        tenant_id=tenant_id,
                        name=name,
                        description=f"{description} {MARKER}",
                        is_active=True,
                        created_at=now,
                        updated_at=now,
                    )
                )
            existing = set(
                connection.scalars(
                    sa.select(links.c.permission_id).where(links.c.permission_group_id == group_id)
                )
            )
            for code in codes:
                if permission_ids[code] not in existing:
                    connection.execute(
                        links.insert().values(
                            permission_group_id=group_id, permission_id=permission_ids[code]
                        )
                    )
            group_ids[name] = group_id

        unassigned = connection.execute(
            sa.select(memberships.c.id, memberships.c.role).where(
                memberships.c.tenant_id == tenant_id, memberships.c.permission_group_id.is_(None)
            )
        ).all()
        for membership_id, role in unassigned:
            target = default_group_for(role)
            if target in group_ids:
                connection.execute(
                    memberships.update()
                    .where(memberships.c.id == membership_id)
                    .values(permission_group_id=group_ids[target])
                )


def remove_defaults(connection) -> None:
    created = connection.scalars(
        sa.select(groups.c.id).where(groups.c.description.like(f"%{MARKER}"))
    ).all()
    if not created:
        return
    connection.execute(
        memberships.update()
        .where(memberships.c.permission_group_id.in_(created))
        .values(permission_group_id=None)
    )
    connection.execute(links.delete().where(links.c.permission_group_id.in_(created)))
    connection.execute(groups.delete().where(groups.c.id.in_(created)))


def upgrade() -> None:
    apply_defaults(op.get_bind())


def downgrade() -> None:
    remove_defaults(op.get_bind())

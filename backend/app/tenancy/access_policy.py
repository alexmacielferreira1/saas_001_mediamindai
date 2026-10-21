"""Server-side access policy: screens, sensitive entities and grant limits.

Mapa explícito (MM-003). Esconder uma tela no menu não é controle de acesso: as
regras abaixo são aplicadas no servidor.

* ``ENTITY_READ_PERMISSIONS``: entidades sensíveis da API genérica ``records`` que
  exigem uma das permissões listadas também para leitura.
* ``SCREEN_ENTITIES``: entidades que pertencem com exclusividade a uma tela. Quando a
  tela está em ``restricted_screens`` do vínculo (negação explícita feita pelo gestor),
  leitura e escrita dessas entidades são recusadas. Entidades compartilhadas entre
  telas (produção, ativos, cortes, revisão) não entram no mapa para não bloquear o
  fluxo operacional comum.
* ``SCREEN_ROUTES``: telas cujo acesso também protege rotas de domínio
  (ex.: ``gestao`` → ``/management/overview``).

O padrão de telas por cargo espelha ``frontend/src/mediamind/lib/roleCatalog.js`` e é
usado só para limitar o que um gestor pode conceder (MM-005); a visibilidade padrão
do menu continua sendo decidida pelo frontend.
"""

from sqlalchemy.orm import Session

from app.core.errors import PublicError
from app.models.identity import Membership
from app.tenancy.context import CurrentSession, require_membership
from app.tenancy.permissions import effective_permissions

SUPERADMIN_ROLE = "superadmin"
FULL_ACCESS_ROLES = frozenset({"admin", SUPERADMIN_ROLE})
ADMINISTRATIVE_ROLES = FULL_ACCESS_ROLES

ALLOWED_SCREENS = frozenset(
    {
        "producao",
        "videomaker",
        "editor_video",
        "reporter",
        "produtor_reportagem",
        "diretor_programa",
        "estagiario",
        "programacao",
        "qualidade",
        "redacao",
        "design",
        "assessoria",
        "audiovisual",
        "revistas",
        "endomarketing",
        "documentacao",
        "gestao",
        "cedoc",
        "apresentador",
        "locutor",
        "sonoplasta",
        "fotografo",
        "motion_designer",
        "cenografo",
        "roteirista",
        "revisor",
        "tradutor",
        "social_media",
        "coordenador_comunicacao",
        "juridico",
        "ti_suporte",
    }
)

# Cargos cujo id não coincide com o id da tela padrão; os demais cargos do catálogo
# usam a tela de mesmo nome. "viewer" e cargos desconhecidos não têm tela padrão.
_ROLE_SCREEN_ALIASES = {
    "mvp": {"producao"},
    "producer": {"producao"},
    "editor": {"editor_video"},
    "journalist": {"redacao"},
    "diretor_programa": {"diretor_programa", "gestao"},
    "coordenador_comunicacao": {"coordenador_comunicacao", "gestao"},
}

AUDIT_READ_PERMISSIONS = frozenset({"users.manage", "permissions.manage"})
ENTITY_READ_PERMISSIONS: dict[str, frozenset[str]] = {
    "LogAuditoria": AUDIT_READ_PERMISSIONS,
}

SCREEN_ENTITIES: dict[str, frozenset[str]] = {
    "assessoria": frozenset({"Clipping", "Jornalista", "Mencao", "Release"}),
    "gestao": frozenset({"LogAuditoria"}),
}

SCREEN_ROUTES: dict[str, str] = {
    "management.overview": "gestao",
}

DENIED = ("PERMISSION_DENIED", "Você não possui permissão para esta ação.")


def role_default_screens(role: str) -> frozenset[str]:
    if role in FULL_ACCESS_ROLES:
        return ALLOWED_SCREENS
    if role in _ROLE_SCREEN_ALIASES:
        return frozenset(_ROLE_SCREEN_ALIASES[role])
    return frozenset({role}) if role in ALLOWED_SCREENS else frozenset()


def effective_screens(membership: Membership) -> frozenset[str]:
    base = set(role_default_screens(membership.role))
    base |= set(membership.extra_screens or [])
    base -= set(membership.restricted_screens or [])
    return frozenset(base & ALLOWED_SCREENS)


def screen_restricted(membership: Membership, screen: str) -> bool:
    return screen in set(membership.restricted_screens or [])


def require_screen(current: CurrentSession, screen: str) -> None:
    """Refuse when the manager explicitly removed ``screen`` from this member."""
    membership = require_membership(current)
    if screen_restricted(membership, screen):
        raise PublicError(403, "SCREEN_ACCESS_DENIED", "Esta tela não está liberada para você.")


def require_entity_screens(current: CurrentSession, entity_type: str) -> None:
    for screen, entities in SCREEN_ENTITIES.items():
        if entity_type in entities:
            require_screen(current, screen)


def require_entity_read(session: Session, current: CurrentSession, entity_type: str) -> None:
    require_membership(current)
    require_entity_screens(current, entity_type)
    required = ENTITY_READ_PERMISSIONS.get(entity_type)
    if required and not (required & effective_permissions(session, current)):
        raise PublicError(403, *DENIED)


def is_superadmin(current: CurrentSession) -> bool:
    membership = current.membership
    return membership is not None and membership.role == SUPERADMIN_ROLE


def ensure_can_grant_permissions(
    session: Session, current: CurrentSession, codes: set[str]
) -> None:
    """MM-005: o gestor só concede permissões que ele próprio possui."""
    if is_superadmin(current):
        return
    missing = set(codes) - effective_permissions(session, current)
    if missing:
        raise PublicError(
            403,
            "GRANT_EXCEEDS_AUTHORITY",
            "Você não pode conceder permissões que não possui.",
        )


def ensure_can_grant_screens(current: CurrentSession, screens: set[str]) -> None:
    """MM-005: o gestor só libera telas que ele próprio acessa."""
    if is_superadmin(current) or not screens:
        return
    if not set(screens) <= effective_screens(require_membership(current)):
        raise PublicError(
            403,
            "GRANT_EXCEEDS_AUTHORITY",
            "Você não pode liberar telas que não acessa.",
        )


def ensure_can_manage_target(session: Session, current: CurrentSession, target: Membership) -> None:
    """Quem não é administrador não altera o acesso de um administrador."""
    if is_superadmin(current):
        return
    if target.role == SUPERADMIN_ROLE:
        raise PublicError(
            403,
            "GRANT_EXCEEDS_AUTHORITY",
            "Somente um superadministrador altera o acesso de outro superadministrador.",
        )
    if target.role in ADMINISTRATIVE_ROLES and (
        "users.manage_admin" not in effective_permissions(session, current)
    ):
        raise PublicError(
            403,
            "GRANT_EXCEEDS_AUTHORITY",
            "Você não pode alterar o acesso de um administrador.",
        )

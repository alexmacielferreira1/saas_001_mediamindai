from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import PublicError
from app.models.identity import (
    Membership,
    Permission,
    PermissionGroup,
    User,
    permission_group_permissions,
)
from app.tenancy.context import CurrentSession, require_membership

# Mesmo valor de access_policy.SUPERADMIN_ROLE (importar de lá criaria import circular).
SUPERADMIN_ROLE = "superadmin"


def _in_selected_tenant(current: CurrentSession) -> bool:
    membership = current.membership
    tenant = current.tenant
    return membership is not None and tenant is not None and membership.tenant_id == tenant.id


def is_tenant_superadmin(current: CurrentSession) -> bool:
    """Superadmin da empresa selecionada (o vínculo precisa ser dessa mesma empresa)."""
    return _in_selected_tenant(current) and current.membership.role == SUPERADMIN_ROLE


def effective_permissions(session: Session, current: CurrentSession) -> set[str]:
    if not _in_selected_tenant(current):
        return set()
    # Superadmin tem todo o catálogo na própria empresa, mesmo sem grupo (decisão de 27/10/2026);
    # assim as checagens que leem estas permissões direto (auditoria, IA) concordam com
    # require_permission.
    if is_tenant_superadmin(current):
        return set(session.scalars(select(Permission.code)))
    membership = current.membership
    tenant = current.tenant
    if membership.permission_group_id is None:
        return set()

    return set(
        session.scalars(
            select(Permission.code)
            .join(
                permission_group_permissions,
                permission_group_permissions.c.permission_id == Permission.id,
            )
            .join(
                PermissionGroup,
                PermissionGroup.id == permission_group_permissions.c.permission_group_id,
            )
            .where(
                PermissionGroup.id == membership.permission_group_id,
                PermissionGroup.tenant_id == tenant.id,
                PermissionGroup.is_active.is_(True),
            )
        )
    )


def require_permission(
    session: Session,
    current: CurrentSession,
    permission_code: str,
) -> CurrentSession:
    require_membership(current)
    # Superadmin tem acesso total na própria empresa (como nas telas, em access_policy),
    # inclusive a códigos que ainda não existam no catálogo; não depende do grupo.
    if is_tenant_superadmin(current):
        return current
    if permission_code not in effective_permissions(session, current):
        raise PublicError(403, "PERMISSION_DENIED", "Você não possui permissão para esta ação.")
    return current


USER_MANAGER_PERMISSION = "users.manage"


def count_user_managers(session: Session, tenant_id) -> int:
    """Active members of the company whose active group grants ``users.manage``."""
    return session.scalar(
        select(func.count(func.distinct(Membership.id)))
        .join(User, User.id == Membership.user_id)
        .join(PermissionGroup, PermissionGroup.id == Membership.permission_group_id)
        .join(
            permission_group_permissions,
            permission_group_permissions.c.permission_group_id == PermissionGroup.id,
        )
        .join(Permission, Permission.id == permission_group_permissions.c.permission_id)
        .where(
            Membership.tenant_id == tenant_id,
            Membership.is_active.is_(True),
            User.is_active.is_(True),
            User.account_status != "suspended",
            PermissionGroup.tenant_id == tenant_id,
            PermissionGroup.is_active.is_(True),
            Permission.code == USER_MANAGER_PERMISSION,
        )
    )


def ensure_keeps_user_manager(session: Session, tenant_id, managers_before: int) -> None:
    """Refuses (and discards) a change that leaves the company without any user manager.

    Companies that already had none (legacy data) are not blocked by this rule.
    """
    session.flush()
    if managers_before and not count_user_managers(session, tenant_id):
        session.rollback()
        raise PublicError(
            409,
            "LAST_USER_MANAGER",
            "A empresa precisa manter ao menos um membro ativo que gerencie usuários.",
        )

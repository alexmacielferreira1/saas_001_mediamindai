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


def effective_permissions(session: Session, current: CurrentSession) -> set[str]:
    membership = current.membership
    tenant = current.tenant
    if (
        membership is None
        or tenant is None
        or membership.tenant_id != tenant.id
        or membership.permission_group_id is None
    ):
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

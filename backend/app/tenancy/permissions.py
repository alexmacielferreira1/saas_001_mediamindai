from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import PublicError
from app.models.identity import Permission, PermissionGroup, permission_group_permissions
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

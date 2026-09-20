from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import Membership, PermissionGroup
from app.schemas.permissions import (
    MembershipPermissionGroupResponse,
    MembershipPermissionGroupUpdate,
)
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/memberships", tags=["permissions"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]


@router.put(
    "/{membership_id}/permission-group",
    response_model=MembershipPermissionGroupResponse,
)
def assign_permission_group(
    membership_id: UUID,
    body: MembershipPermissionGroupUpdate,
    current: Authenticated,
    session: DbSession,
):
    selected_membership = require_membership(current)
    require_permission(session, current, "permissions.manage")
    target = session.scalar(
        select(Membership).where(
            Membership.id == membership_id,
            Membership.tenant_id == selected_membership.tenant_id,
        )
    )
    if target is None:
        raise PublicError(404, "MEMBERSHIP_NOT_FOUND", "Vínculo de usuário não encontrado.")
    if body.permission_group_id is not None:
        group = session.scalar(
            select(PermissionGroup).where(
                PermissionGroup.id == body.permission_group_id,
                PermissionGroup.tenant_id == selected_membership.tenant_id,
                PermissionGroup.is_active.is_(True),
            )
        )
        if group is None:
            raise PublicError(
                404,
                "PERMISSION_GROUP_NOT_FOUND",
                "Grupo de permissões não encontrado.",
            )
    target.permission_group_id = body.permission_group_id
    session.commit()
    return MembershipPermissionGroupResponse(
        membership_id=target.id,
        permission_group_id=target.permission_group_id,
    )

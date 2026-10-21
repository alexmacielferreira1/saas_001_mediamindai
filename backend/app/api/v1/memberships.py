from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.v1.records import add_audit
from app.core.errors import PublicError
from app.db.session import get_session
from app.demo_accounts import DEMO_ACCOUNTS
from app.models.identity import Membership, PermissionGroup, User
from app.schemas.permissions import (
    MembershipListResponse,
    MembershipPermissionGroupResponse,
    MembershipPermissionGroupUpdate,
    MembershipResponse,
    MembershipRoleResponse,
    MembershipRoleUpdate,
    MembershipScreensResponse,
    MembershipScreensUpdate,
)
from app.tenancy.access_policy import (
    ADMINISTRATIVE_ROLES,
    ALLOWED_SCREENS,
    SUPERADMIN_ROLE,
    ensure_can_grant_permissions,
    ensure_can_grant_screens,
    ensure_can_manage_target,
    is_superadmin,
    role_default_screens,
)
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import (
    count_user_managers,
    ensure_keeps_user_manager,
    require_permission,
)

router = APIRouter(prefix="/memberships", tags=["permissions"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
ALLOWED_ROLES = {role for _email, _name, role in DEMO_ACCOUNTS} | {"mvp"}


def _load_target(session: Session, tenant_id: UUID, membership_id: UUID) -> Membership:
    target = session.scalar(
        select(Membership).where(
            Membership.id == membership_id,
            Membership.tenant_id == tenant_id,
        )
    )
    if target is None:
        raise PublicError(404, "MEMBERSHIP_NOT_FOUND", "Vínculo de usuário não encontrado.")
    return target


def _group_snapshot(session: Session, group_id: UUID | None) -> dict:
    group = session.get(PermissionGroup, group_id) if group_id else None
    if group is None:
        return {"permission_group_id": None, "permission_group_name": None}
    return {"permission_group_id": str(group.id), "permission_group_name": group.name}


@router.get("", response_model=MembershipListResponse)
def list_memberships(current: Authenticated, session: DbSession):
    selected_membership = require_membership(current)
    require_permission(session, current, "permissions.manage")
    rows = session.execute(
        select(Membership, User)
        .join(User, User.id == Membership.user_id)
        .where(Membership.tenant_id == selected_membership.tenant_id)
        .order_by(User.email_normalized)
    ).all()
    return MembershipListResponse(
        memberships=[
            MembershipResponse(
                id=membership.id,
                user_id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=membership.role,
                permission_group_id=membership.permission_group_id,
                extra_screens=membership.extra_screens or [],
                restricted_screens=membership.restricted_screens or [],
            )
            for membership, user in rows
        ]
    )


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
    target = _load_target(session, selected_membership.tenant_id, membership_id)
    ensure_can_manage_target(session, current, target)
    if body.permission_group_id is not None:
        group = session.scalar(
            select(PermissionGroup)
            .options(selectinload(PermissionGroup.permissions))
            .where(
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
        # MM-005: o grupo não pode dar ao alvo permissões que o gestor não tem.
        ensure_can_grant_permissions(session, current, {item.code for item in group.permissions})
    before = _group_snapshot(session, target.permission_group_id)
    managers_before = count_user_managers(session, selected_membership.tenant_id)
    target.permission_group_id = body.permission_group_id
    add_audit(
        session,
        current,
        "membership.permission_group_changed",
        "Membership",
        str(target.id),
        before=before,
        after=_group_snapshot(session, target.permission_group_id),
        reason=body.reason,
        target_user_id=str(target.user_id),
    )
    ensure_keeps_user_manager(session, selected_membership.tenant_id, managers_before)
    session.commit()
    return MembershipPermissionGroupResponse(
        membership_id=target.id,
        permission_group_id=target.permission_group_id,
    )


@router.put("/{membership_id}/role", response_model=MembershipRoleResponse)
def update_membership_role(
    membership_id: UUID,
    body: MembershipRoleUpdate,
    current: Authenticated,
    session: DbSession,
):
    selected_membership = require_membership(current)
    require_permission(session, current, "users.manage")
    if body.role not in ALLOWED_ROLES:
        raise PublicError(422, "VALIDATION_ERROR", "Cargo informado não é reconhecido.")
    if body.role in ADMINISTRATIVE_ROLES:
        require_permission(session, current, "users.manage_admin")
    if body.role == SUPERADMIN_ROLE and not is_superadmin(current):
        raise PublicError(
            403,
            "GRANT_EXCEEDS_AUTHORITY",
            "Somente um superadministrador concede o cargo de superadministrador.",
        )
    target = _load_target(session, selected_membership.tenant_id, membership_id)
    ensure_can_manage_target(session, current, target)
    # Telas padrão do novo cargo que o alvo ainda não tinha também são uma concessão.
    ensure_can_grant_screens(
        current, set(role_default_screens(body.role)) - set(role_default_screens(target.role))
    )
    before = {"role": target.role}
    target.role = body.role
    add_audit(
        session,
        current,
        "membership.role_changed",
        "Membership",
        str(target.id),
        before=before,
        after={"role": target.role},
        reason=body.reason,
        target_user_id=str(target.user_id),
    )
    session.commit()
    return MembershipRoleResponse(membership_id=target.id, role=target.role)


@router.put("/{membership_id}/screens", response_model=MembershipScreensResponse)
def update_membership_screens(
    membership_id: UUID,
    body: MembershipScreensUpdate,
    current: Authenticated,
    session: DbSession,
):
    selected_membership = require_membership(current)
    require_permission(session, current, "users.manage")
    extra = set(body.extra_screens)
    restricted = set(body.restricted_screens)
    if not extra.union(restricted).issubset(ALLOWED_SCREENS) or extra.intersection(restricted):
        raise PublicError(422, "VALIDATION_ERROR", "Ajustes de telas inválidos.")
    target = _load_target(session, selected_membership.tenant_id, membership_id)
    ensure_can_manage_target(session, current, target)
    previous_extra = set(target.extra_screens or [])
    previous_restricted = set(target.restricted_screens or [])
    # Conceder = nova tela extra ou retirada de uma restrição existente.
    ensure_can_grant_screens(current, (extra - previous_extra) | (previous_restricted - restricted))
    before = {
        "extra_screens": sorted(previous_extra),
        "restricted_screens": sorted(previous_restricted),
    }
    target.extra_screens = sorted(extra)
    target.restricted_screens = sorted(restricted)
    add_audit(
        session,
        current,
        "membership.screens_changed",
        "Membership",
        str(target.id),
        before=before,
        after={
            "extra_screens": target.extra_screens,
            "restricted_screens": target.restricted_screens,
        },
        reason=body.reason,
        target_user_id=str(target.user_id),
    )
    session.commit()
    return MembershipScreensResponse(
        membership_id=target.id,
        extra_screens=target.extra_screens,
        restricted_screens=target.restricted_screens,
    )

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

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
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/memberships", tags=["permissions"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
ALLOWED_ROLES = {role for _email, _name, role in DEMO_ACCOUNTS} | {"mvp"}
ADMINISTRATIVE_ROLES = {"admin", "superadmin"}
ALLOWED_SCREENS = {
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
    target = session.scalar(
        select(Membership).where(
            Membership.id == membership_id,
            Membership.tenant_id == selected_membership.tenant_id,
        )
    )
    if target is None:
        raise PublicError(404, "MEMBERSHIP_NOT_FOUND", "Vínculo de usuário não encontrado.")
    target.role = body.role
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
    target = session.scalar(
        select(Membership).where(
            Membership.id == membership_id,
            Membership.tenant_id == selected_membership.tenant_id,
        )
    )
    if target is None:
        raise PublicError(404, "MEMBERSHIP_NOT_FOUND", "Vínculo de usuário não encontrado.")
    target.extra_screens = sorted(extra)
    target.restricted_screens = sorted(restricted)
    session.commit()
    return MembershipScreensResponse(
        membership_id=target.id,
        extra_screens=target.extra_screens,
        restricted_screens=target.restricted_screens,
    )

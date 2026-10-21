from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.v1.records import add_audit
from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import Membership, Permission, PermissionGroup
from app.schemas.permissions import (
    PermissionGroupCreate,
    PermissionGroupListResponse,
    PermissionGroupResponse,
    PermissionGroupUpdate,
)
from app.tenancy.access_policy import ensure_can_grant_permissions
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import (
    count_user_managers,
    ensure_keeps_user_manager,
    require_permission,
)

router = APIRouter(prefix="/permission-groups", tags=["permissions"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]


def serialize(group: PermissionGroup) -> PermissionGroupResponse:
    return PermissionGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        is_active=group.is_active,
        permission_codes=sorted(item.code for item in group.permissions),
    )


def load_permissions(session: Session, codes: list[str]) -> list[Permission]:
    unique_codes = set(codes)
    permissions = list(session.scalars(select(Permission).where(Permission.code.in_(unique_codes))))
    if {item.code for item in permissions} != unique_codes:
        raise PublicError(422, "UNKNOWN_PERMISSION", "Uma ou mais permissões são desconhecidas.")
    return permissions


def find_group(session: Session, tenant_id: UUID, group_id: UUID) -> PermissionGroup:
    group = session.scalar(
        select(PermissionGroup)
        .options(selectinload(PermissionGroup.permissions))
        .where(PermissionGroup.id == group_id, PermissionGroup.tenant_id == tenant_id)
    )
    if group is None:
        raise PublicError(404, "PERMISSION_GROUP_NOT_FOUND", "Grupo de permissões não encontrado.")
    return group


def group_snapshot(group: PermissionGroup) -> dict:
    return {
        "name": group.name,
        "description": group.description,
        "is_active": group.is_active,
        "permission_codes": sorted(item.code for item in group.permissions),
    }


def commit_group(
    session: Session, group: PermissionGroup, managers_before: int | None = None
) -> PermissionGroup:
    try:
        if managers_before is not None:
            ensure_keeps_user_manager(session, group.tenant_id, managers_before)
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise PublicError(
            409,
            "PERMISSION_GROUP_CONFLICT",
            "Já existe um grupo com esse nome nesta empresa.",
        ) from exc
    session.refresh(group)
    return find_group(session, group.tenant_id, group.id)


@router.get("", response_model=PermissionGroupListResponse)
def list_permission_groups(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    groups = session.scalars(
        select(PermissionGroup)
        .options(selectinload(PermissionGroup.permissions))
        .where(PermissionGroup.tenant_id == membership.tenant_id)
        .order_by(PermissionGroup.name)
    ).all()
    return PermissionGroupListResponse(permission_groups=[serialize(item) for item in groups])


@router.post("", response_model=PermissionGroupResponse, status_code=201)
def create_permission_group(
    body: PermissionGroupCreate,
    current: Authenticated,
    session: DbSession,
):
    membership = require_membership(current)
    require_permission(session, current, "permissions.manage")
    permissions = load_permissions(session, body.permission_codes)
    # MM-005: ninguém cria grupo com permissões que não possui.
    ensure_can_grant_permissions(session, current, {item.code for item in permissions})
    group = PermissionGroup(
        id=uuid4(),
        tenant_id=membership.tenant_id,
        name=body.name,
        description=body.description,
        permissions=permissions,
    )
    session.add(group)
    add_audit(
        session,
        current,
        "permission_group.created",
        "PermissionGroup",
        str(group.id),
        after=group_snapshot(group),
    )
    return serialize(commit_group(session, group))


@router.patch("/{group_id}", response_model=PermissionGroupResponse)
def update_permission_group(
    group_id: UUID,
    body: PermissionGroupUpdate,
    current: Authenticated,
    session: DbSession,
):
    membership = require_membership(current)
    require_permission(session, current, "permissions.manage")
    group = find_group(session, membership.tenant_id, group_id)
    before = group_snapshot(group)
    # Alterar um grupo mais poderoso que o gestor afetaria quem tem mais autoridade.
    ensure_can_grant_permissions(session, current, set(before["permission_codes"]))
    managers_before = count_user_managers(session, membership.tenant_id)
    if body.name is not None:
        group.name = body.name
    if body.description is not None:
        group.description = body.description
    if body.permission_codes is not None:
        permissions = load_permissions(session, body.permission_codes)
        ensure_can_grant_permissions(session, current, {item.code for item in permissions})
        group.permissions = permissions
    add_audit(
        session,
        current,
        "permission_group.updated",
        "PermissionGroup",
        str(group.id),
        before=before,
        after=group_snapshot(group),
        reason=body.reason,
    )
    return serialize(commit_group(session, group, managers_before))


@router.delete("/{group_id}", status_code=204)
def delete_permission_group(
    group_id: UUID,
    current: Authenticated,
    session: DbSession,
):
    membership = require_membership(current)
    require_permission(session, current, "permissions.manage")
    group = find_group(session, membership.tenant_id, group_id)
    before = group_snapshot(group)
    ensure_can_grant_permissions(session, current, set(before["permission_codes"]))
    managers_before = count_user_managers(session, membership.tenant_id)
    unassigned = session.scalars(
        select(Membership.id).where(Membership.permission_group_id == group.id)
    ).all()
    group.is_active = False
    add_audit(
        session,
        current,
        "permission_group.deactivated",
        "PermissionGroup",
        str(group.id),
        {"unassigned_memberships": len(unassigned)},
        before=before,
        after=group_snapshot(group),
    )
    session.execute(
        update(Membership)
        .where(Membership.permission_group_id == group.id)
        .values(permission_group_id=None)
    )
    ensure_keeps_user_manager(session, membership.tenant_id, managers_before)
    session.commit()
    return Response(status_code=204)

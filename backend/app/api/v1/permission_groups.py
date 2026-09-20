from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import Membership, Permission, PermissionGroup
from app.schemas.permissions import (
    PermissionGroupCreate,
    PermissionGroupListResponse,
    PermissionGroupResponse,
    PermissionGroupUpdate,
)
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

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


def commit_group(session: Session, group: PermissionGroup) -> PermissionGroup:
    try:
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
    group = PermissionGroup(
        tenant_id=membership.tenant_id,
        name=body.name,
        description=body.description,
        permissions=load_permissions(session, body.permission_codes),
    )
    session.add(group)
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
    if body.name is not None:
        group.name = body.name
    if body.description is not None:
        group.description = body.description
    if body.permission_codes is not None:
        group.permissions = load_permissions(session, body.permission_codes)
    return serialize(commit_group(session, group))


@router.delete("/{group_id}", status_code=204)
def delete_permission_group(
    group_id: UUID,
    current: Authenticated,
    session: DbSession,
):
    membership = require_membership(current)
    require_permission(session, current, "permissions.manage")
    group = find_group(session, membership.tenant_id, group_id)
    group.is_active = False
    session.execute(
        update(Membership)
        .where(Membership.permission_group_id == group.id)
        .values(permission_group_id=None)
    )
    session.commit()
    return Response(status_code=204)

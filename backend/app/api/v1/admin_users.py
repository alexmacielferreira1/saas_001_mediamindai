from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.api.v1.records import add_audit
from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import AuthSession, Membership, PermissionGroup, User
from app.schemas.admin_users import (
    AdminUserDetail,
    AdminUserListResponse,
    AdminUserSessionsRevoked,
    AdminUserStatusChange,
    AdminUserSummary,
)
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/admin/users", tags=["admin-users"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
ACCOUNT_STATUSES = {"invited", "active", "suspended", "blocked", "disabled", "expired", "deleted"}


def _base_query(tenant_id: UUID):
    last_access = (
        select(func.max(AuthSession.last_seen_at))
        .where(AuthSession.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    return (
        select(Membership, User, PermissionGroup, last_access.label("last_access_at"))
        .join(User, User.id == Membership.user_id)
        .outerjoin(PermissionGroup, PermissionGroup.id == Membership.permission_group_id)
        .where(Membership.tenant_id == tenant_id)
    )


def _status(membership: Membership, user: User) -> str:
    # A suspensão feita por uma empresa vale só para o vínculo dela; os demais estados
    # continuam vindo da conta.
    if user.account_status != "active":
        return user.account_status
    return "active" if membership.is_active else "suspended"


def _detail(membership, user, profile, last_access_at) -> AdminUserDetail:
    return AdminUserDetail(
        **_summary(membership, user, profile, last_access_at).model_dump(),
        extra_screens=membership.extra_screens or [],
        restricted_screens=membership.restricted_screens or [],
        failed_login_attempts=user.failed_login_attempts,
        locked_until=user.locked_until,
    )


def _revoke_tenant_sessions(session: Session, user_id: UUID, tenant_id: UUID) -> int:
    # Só as sessões abertas nesta empresa; sessões em outras empresas não pertencem a ela.
    now = datetime.now(UTC)
    rows = session.scalars(
        select(AuthSession).where(
            AuthSession.user_id == user_id,
            AuthSession.selected_tenant_id == tenant_id,
            AuthSession.revoked_at.is_(None),
        )
    ).all()
    for row in rows:
        row.revoked_at = now
    return len(rows)


def _summary(membership, user, profile, last_access_at) -> AdminUserSummary:
    return AdminUserSummary(
        id=user.id,
        membership_id=membership.id,
        full_name=user.full_name,
        email=user.email,
        tenant_role=membership.role,
        profile_id=profile.id if profile else None,
        profile_name=profile.name if profile else None,
        status=_status(membership, user),
        last_access_at=last_access_at,
        created_at=user.created_at,
    )


def _load_scoped_user(session: Session, tenant_id: UUID, user_id: UUID):
    row = session.execute(_base_query(tenant_id).where(User.id == user_id)).one_or_none()
    if row is None:
        raise PublicError(404, "ADMIN_USER_NOT_FOUND", "Usuário não encontrado.")
    return row


@router.get("", response_model=AdminUserListResponse)
def list_admin_users(
    current: Authenticated,
    session: DbSession,
    status: str | None = None,
    search: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
):
    selected = require_membership(current)
    require_permission(session, current, "users.manage")
    if status is not None and status not in ACCOUNT_STATUSES:
        raise PublicError(422, "VALIDATION_ERROR", "Estado de usuário inválido.")
    query = _base_query(selected.tenant_id)
    if status == "suspended":
        query = query.where(
            or_(User.account_status == "suspended", Membership.is_active.is_(False))
        )
    elif status == "active":
        query = query.where(and_(User.account_status == "active", Membership.is_active.is_(True)))
    elif status:
        query = query.where(User.account_status == status)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(func.lower(User.full_name).like(term), User.email_normalized.like(term))
        )
    rows = session.execute(query.order_by(User.full_name, User.email_normalized)).all()
    total = len(rows)
    start = (page - 1) * page_size
    return AdminUserListResponse(
        items=[_summary(*row) for row in rows[start : start + page_size]],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{user_id}", response_model=AdminUserDetail)
def get_admin_user(user_id: UUID, current: Authenticated, session: DbSession):
    selected = require_membership(current)
    require_permission(session, current, "users.manage")
    return _detail(*_load_scoped_user(session, selected.tenant_id, user_id))


@router.post("/{user_id}/suspend", response_model=AdminUserDetail)
def suspend_admin_user(
    user_id: UUID,
    body: AdminUserStatusChange,
    current: Authenticated,
    session: DbSession,
):
    selected = require_membership(current)
    require_permission(session, current, "users.manage")
    membership, user, profile, last_access_at = _load_scoped_user(
        session, selected.tenant_id, user_id
    )
    if user.id == current.user.id:
        raise PublicError(409, "SELF_STATUS_CHANGE", "Você não pode suspender a própria conta.")
    if _status(membership, user) != "active":
        raise PublicError(409, "USER_STATUS_CONFLICT", "A conta não está ativa.")
    membership.is_active = False
    revoked = _revoke_tenant_sessions(session, user.id, selected.tenant_id)
    add_audit(
        session,
        current,
        "user.suspended",
        "User",
        str(user.id),
        {"reason": body.reason, "revoked_sessions": revoked},
    )
    session.commit()
    return _detail(membership, user, profile, last_access_at)


@router.post("/{user_id}/reactivate", response_model=AdminUserDetail)
def reactivate_admin_user(
    user_id: UUID,
    body: AdminUserStatusChange,
    current: Authenticated,
    session: DbSession,
):
    selected = require_membership(current)
    require_permission(session, current, "users.manage")
    membership, user, profile, last_access_at = _load_scoped_user(
        session, selected.tenant_id, user_id
    )
    if _status(membership, user) != "suspended":
        raise PublicError(409, "USER_STATUS_CONFLICT", "A conta não está suspensa.")
    membership.is_active = True
    if user.account_status == "suspended":
        # Suspensões antigas eram gravadas na conta; a reativação também as desfaz.
        user.account_status = "active"
        user.is_active = True
    add_audit(session, current, "user.reactivated", "User", str(user.id), {"reason": body.reason})
    session.commit()
    return _detail(membership, user, profile, last_access_at)


@router.post("/{user_id}/revoke-sessions", response_model=AdminUserSessionsRevoked)
def revoke_admin_user_sessions(
    user_id: UUID,
    body: AdminUserStatusChange,
    current: Authenticated,
    session: DbSession,
):
    selected = require_membership(current)
    require_permission(session, current, "users.manage")
    _membership, user, _profile, _last = _load_scoped_user(session, selected.tenant_id, user_id)
    if user.id == current.user.id:
        raise PublicError(409, "SELF_SESSION_REVOKE", "Use Sair para encerrar a própria sessão.")
    revoked = _revoke_tenant_sessions(session, user.id, selected.tenant_id)
    add_audit(
        session,
        current,
        "user.sessions_revoked",
        "User",
        str(user.id),
        {"reason": body.reason, "revoked_sessions": revoked},
    )
    session.commit()
    return AdminUserSessionsRevoked(revoked_sessions=revoked)

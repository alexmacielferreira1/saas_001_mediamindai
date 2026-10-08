from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import AuthSession, Membership, Tenant, User
from app.repositories.identity import get_active_membership, get_auth_session
from app.security.sessions import hash_session_token

COOKIE_NAME = "mediamind_session"
DbSession = Annotated[Session, Depends(get_session)]
SessionToken = Annotated[str | None, Cookie(alias=COOKIE_NAME)]


@dataclass
class CurrentSession:
    auth_session: AuthSession | None
    user: User | None
    membership: Membership | None
    tenant: Tenant | None


def get_current_session(
    session: DbSession,
    token: SessionToken = None,
) -> CurrentSession:
    auth_session = get_auth_session(session, hash_session_token(token)) if token else None
    now = datetime.now(UTC)
    if auth_session is None or not auth_session.is_active(now):
        raise PublicError(401, "AUTHENTICATION_REQUIRED", "Faça login para continuar.")
    user = session.get(User, auth_session.user_id)
    if user is None or not user.is_active:
        raise PublicError(401, "AUTHENTICATION_REQUIRED", "Faça login para continuar.")
    membership_row = (
        get_active_membership(session, user.id, auth_session.selected_tenant_id)
        if auth_session.selected_tenant_id
        else None
    )
    membership, tenant = membership_row if membership_row else (None, None)
    auth_session.last_seen_at = now
    session.commit()
    return CurrentSession(auth_session, user, membership, tenant)


def require_membership(current: CurrentSession) -> Membership:
    if current.membership is None:
        raise PublicError(403, "TENANT_ACCESS_DENIED", "Acesso à empresa não autorizado.")
    return current.membership


def require_role(current: CurrentSession, allowed_roles: set[str]) -> CurrentSession:
    membership = require_membership(current)
    if membership.role not in allowed_roles:
        raise HTTPException(403, "role not allowed")
    return current

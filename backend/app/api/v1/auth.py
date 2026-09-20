from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import error_response
from app.db.session import get_session
from app.models.identity import User
from app.repositories.identity import get_auth_session, list_active_memberships, revoke_auth_session
from app.schemas.auth import LoginRequest as LoginBody
from app.schemas.auth import MembershipResponse, SessionResponse, UserResponse
from app.security.sessions import hash_session_token
from app.services.auth import authenticate

router = APIRouter(prefix="/auth", tags=["auth"])
COOKIE_NAME = "mediamind_session"
DbSession = Annotated[Session, Depends(get_session)]
SessionToken = Annotated[str | None, Cookie(alias=COOKIE_NAME)]


def session_payload(session: Session, auth_session) -> SessionResponse:
    user = session.get(User, auth_session.user_id)
    memberships = list_active_memberships(session, user.id)
    return SessionResponse(
        user=UserResponse(id=user.id, email=user.email, full_name=user.full_name),
        memberships=[
            MembershipResponse(
                tenant_id=membership.tenant_id, tenant_name=tenant.name, role=membership.role
            )
            for membership, tenant in memberships
        ],
        selected_tenant_id=auth_session.selected_tenant_id,
    )


@router.post("/login", response_model=SessionResponse)
def login(body: LoginBody, request: Request, response: Response, session: DbSession):
    settings = get_settings()
    result = authenticate(session, body.email, body.password, session_hours=settings.session_hours)
    if result is None:
        return error_response(request, 401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.")
    response.set_cookie(
        COOKIE_NAME,
        result.token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=settings.session_hours * 3600,
        path="/",
    )
    return session_payload(session, result.auth_session)


@router.get("/session", response_model=SessionResponse)
def current_session(
    request: Request,
    session: DbSession,
    token: SessionToken = None,
):
    auth_session = get_auth_session(session, hash_session_token(token)) if token else None
    if auth_session is None or not auth_session.is_active(datetime.now(UTC)):
        return error_response(request, 401, "AUTHENTICATION_REQUIRED", "Faça login para continuar.")
    auth_session.last_seen_at = datetime.now(UTC)
    session.commit()
    return session_payload(session, auth_session)


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    session: DbSession,
    token: SessionToken = None,
):
    if token:
        auth_session = get_auth_session(session, hash_session_token(token))
        if auth_session is not None and auth_session.revoked_at is None:
            revoke_auth_session(session, auth_session, datetime.now(UTC))
    response.delete_cookie(COOKIE_NAME, path="/", samesite="lax")
    response.status_code = 204

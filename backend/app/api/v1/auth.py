from datetime import UTC, datetime
from secrets import compare_digest, token_urlsafe
from typing import Annotated

import httpx
from fastapi import APIRouter, Cookie, Depends, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import error_response
from app.db.session import get_session
from app.demo_accounts import DEMO_ACCOUNTS
from app.models.identity import User
from app.repositories.identity import (
    get_auth_session,
    get_user_by_email,
    list_active_memberships,
    revoke_auth_session,
)
from app.schemas.auth import LoginRequest as LoginBody
from app.schemas.auth import MembershipResponse, SessionResponse, UserResponse
from app.security.sessions import hash_session_token
from app.services.auth import (
    account_allows_sign_in,
    authenticate,
    create_session_for_user,
    is_locked,
    normalize_email,
)
from app.services.google_oauth import authorization_url, exchange_google_code
from app.tenancy.context import CurrentSession, get_current_session

router = APIRouter(prefix="/auth", tags=["auth"])
COOKIE_NAME = "mediamind_session"
GOOGLE_STATE_COOKIE = "mediamind_google_state"
DbSession = Annotated[Session, Depends(get_session)]
SessionToken = Annotated[str | None, Cookie(alias=COOKIE_NAME)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]


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


def session_cookie_samesite(settings) -> str:
    # Production frontend/backend use different origins. Cross-origin fetches need
    # SameSite=None + Secure so the browser sends the session cookie.
    return "none" if settings.session_cookie_secure else "lax"


def set_session_cookie(response: Response, token: str, settings) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=session_cookie_samesite(settings),
        max_age=settings.session_hours * 3600,
        path="/",
    )


@router.post("/login", response_model=SessionResponse)
def login(body: LoginBody, request: Request, response: Response, session: DbSession):
    settings = get_settings()
    result = authenticate(
        session,
        body.email,
        body.password,
        session_hours=settings.session_hours,
        max_attempts=settings.login_max_attempts,
        lockout_minutes=settings.login_lockout_minutes,
    )
    if result is None:
        return error_response(request, 401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.")
    set_session_cookie(response, result.token, settings)
    return session_payload(session, result.auth_session)


class DemoLoginBody(BaseModel):
    email: str = Field(min_length=3, max_length=320)


@router.post("/demo", response_model=SessionResponse)
def demo_login(body: DemoLoginBody, request: Request, response: Response, session: DbSession):
    settings = get_settings()
    if settings.environment not in {"local", "test"}:
        return error_response(request, 404, "NOT_FOUND", "Recurso não encontrado.")
    if body.email.strip().lower() not in {account[0] for account in DEMO_ACCOUNTS}:
        return error_response(request, 403, "DEMO_ACCOUNT_DENIED", "Conta demo não autorizada.")
    if not settings.demo_password:
        return error_response(
            request, 503, "DEMO_NOT_CONFIGURED", "Configure o acesso demo local no servidor."
        )
    return login(
        LoginBody(email=body.email, password=settings.demo_password.get_secret_value()),
        request,
        response,
        session,
    )


@router.get("/google/start")
def google_start(request: Request):
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        return error_response(
            request, 503, "GOOGLE_OAUTH_NOT_CONFIGURED", "Login Google ainda não configurado."
        )
    state = token_urlsafe(32)
    response = RedirectResponse(
        authorization_url(
            client_id=settings.google_client_id,
            redirect_uri=settings.google_redirect_uri,
            state=state,
        )
    )
    response.set_cookie(
        GOOGLE_STATE_COOKIE,
        state,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=600,
        path="/api/v1/auth/google",
    )
    return response


@router.get("/google/callback")
async def google_callback(
    session: DbSession,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    oauth_state: Annotated[str | None, Cookie(alias=GOOGLE_STATE_COOKIE)] = None,
):
    settings = get_settings()
    error_base = f"{settings.frontend_url}/login?google_error="

    def failed(reason: str) -> RedirectResponse:
        response = RedirectResponse(error_base + reason)
        response.delete_cookie(GOOGLE_STATE_COOKIE, path="/api/v1/auth/google")
        return response

    if not oauth_state or not state or not compare_digest(state, oauth_state):
        return failed("invalid_state")
    if error:
        return failed("access_denied" if error == "access_denied" else "provider_failed")
    if not settings.google_client_id or not settings.google_client_secret:
        return failed("not_configured")
    if not code:
        return failed("provider_failed")
    try:
        profile = await exchange_google_code(
            code=code,
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret.get_secret_value(),
            redirect_uri=settings.google_redirect_uri,
        )
    except (httpx.HTTPError, KeyError):
        return failed("provider_failed")
    email = normalize_email(profile.get("email", ""))
    user = get_user_by_email(session, email)
    if (
        not profile.get("email_verified")
        or user is None
        or not account_allows_sign_in(user)
        or is_locked(user, datetime.now(UTC))
        or not list_active_memberships(session, user.id)
    ):
        return failed("account_not_allowed")
    result = create_session_for_user(session, user, session_hours=settings.session_hours)
    response = RedirectResponse(f"{settings.frontend_url}/corp?tab=producao")
    set_session_cookie(response, result.token, settings)
    response.delete_cookie(GOOGLE_STATE_COOKIE, path="/api/v1/auth/google")
    return response


@router.get("/session", response_model=SessionResponse)
def current_session(
    current: Authenticated,
    session: DbSession,
):
    return session_payload(session, current.auth_session)


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
    settings = get_settings()
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        secure=settings.session_cookie_secure,
        samesite=session_cookie_samesite(settings),
    )
    response.status_code = 204

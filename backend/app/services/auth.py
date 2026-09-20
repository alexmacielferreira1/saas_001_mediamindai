from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.identity import AuthSession, Membership, Tenant, User
from app.repositories.identity import get_user_by_email, list_active_memberships
from app.security.passwords import hash_password, verify_password
from app.security.sessions import hash_session_token, new_session_token

DUMMY_PASSWORD_HASH = hash_password("mediamind-dummy-password-not-used-for-login")


@dataclass
class LoginResult:
    user: User
    memberships: list[tuple[Membership, Tenant]]
    token: str
    auth_session: AuthSession


def normalize_email(email: str) -> str:
    return email.strip().casefold()


def create_session_for_user(
    session: Session, user: User, *, session_hours: int, now: datetime | None = None
) -> LoginResult:
    now = now or datetime.now(UTC)
    memberships = list_active_memberships(session, user.id)
    selected_tenant_id = memberships[0][0].tenant_id if memberships else None
    token = new_session_token()
    auth_session = AuthSession(
        user_id=user.id,
        token_hash=hash_session_token(token),
        selected_tenant_id=selected_tenant_id,
        expires_at=now + timedelta(hours=session_hours),
    )
    session.add(auth_session)
    session.commit()
    return LoginResult(user, memberships, token, auth_session)


def authenticate(
    session: Session,
    email: str,
    password: str,
    *,
    session_hours: int,
    max_attempts: int = 5,
    lockout_minutes: int = 15,
    now: datetime | None = None,
) -> LoginResult | None:
    now = now or datetime.now(UTC)
    user = get_user_by_email(session, normalize_email(email))
    password_hash = user.password_hash if user is not None else DUMMY_PASSWORD_HASH
    password_valid = verify_password(password, password_hash)
    if user is None:
        return None
    locked_until = user.locked_until
    if locked_until is not None and locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=UTC)
    if locked_until is not None and locked_until > now:
        return None
    if not password_valid or not user.is_active:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= max_attempts:
            user.locked_until = now + timedelta(minutes=lockout_minutes)
        session.commit()
        return None

    user.failed_login_attempts = 0
    user.locked_until = None

    return create_session_for_user(session, user, session_hours=session_hours, now=now)

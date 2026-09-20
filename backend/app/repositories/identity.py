from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.identity import AuthSession, Membership, Tenant, User


def get_user_by_email(session: Session, email_normalized: str) -> User | None:
    return session.scalar(select(User).where(User.email_normalized == email_normalized))


def list_active_memberships(session: Session, user_id):
    return list(
        session.execute(
            select(Membership, Tenant)
            .join(Tenant, Tenant.id == Membership.tenant_id)
            .where(
                Membership.user_id == user_id,
                Membership.is_active.is_(True),
                Tenant.is_active.is_(True),
            )
            .order_by(Tenant.name)
        ).all()
    )


def get_auth_session(session: Session, token_hash: str) -> AuthSession | None:
    return session.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash))


def revoke_auth_session(session: Session, auth_session: AuthSession, revoked_at: datetime) -> None:
    auth_session.revoked_at = revoked_at
    session.commit()

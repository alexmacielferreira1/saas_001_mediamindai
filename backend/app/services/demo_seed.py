from sqlalchemy import select
from sqlalchemy.orm import Session

from app.demo_accounts import DEMO_ACCOUNTS
from app.models.identity import Membership, Tenant, User
from app.security.passwords import hash_password


def seed_demo_accounts(session: Session, password: str, environment: str) -> dict[str, int | str]:
    if environment not in {"local", "test"}:
        raise RuntimeError("O seed de demonstração funciona somente em local/test.")
    if len(password) < 12:
        raise ValueError("A senha demo deve ter pelo menos 12 caracteres.")

    tenant = session.scalar(select(Tenant).where(Tenant.slug == "mediamind-demo"))
    if tenant is None:
        tenant = Tenant(name="MediaMind Demonstração", slug="mediamind-demo")
        session.add(tenant)
        session.flush()
    else:
        tenant.name = "MediaMind Demonstração"
        tenant.is_active = True

    created = 0
    updated = 0
    for email, full_name, role in DEMO_ACCOUNTS:
        normalized = email.casefold()
        user = session.scalar(select(User).where(User.email_normalized == normalized))
        if user is None:
            user = User(
                email=email,
                email_normalized=normalized,
                password_hash=hash_password(password),
                full_name=full_name,
            )
            session.add(user)
            session.flush()
            created += 1
        else:
            user.email = email
            user.full_name = full_name
            user.password_hash = hash_password(password)
            user.is_active = True
            updated += 1

        membership = session.scalar(
            select(Membership).where(
                Membership.user_id == user.id,
                Membership.tenant_id == tenant.id,
            )
        )
        if membership is None:
            session.add(Membership(user_id=user.id, tenant_id=tenant.id, role=role))
        else:
            membership.role = role
            membership.is_active = True

    session.commit()
    return {"created": created, "updated": updated, "tenant_id": str(tenant.id)}

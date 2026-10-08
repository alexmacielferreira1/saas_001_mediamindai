from sqlalchemy import select
from sqlalchemy.orm import Session

from app.demo_accounts import DEMO_ACCOUNTS
from app.models.identity import Membership, Permission, PermissionGroup, Tenant, User
from app.security.passwords import hash_password
from app.tenancy.record_policies import CONTENT_WRITE_PERMISSIONS, PERMISSION_CATALOG


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

    permissions = {}
    for code, description in PERMISSION_CATALOG.items():
        permission = session.scalar(select(Permission).where(Permission.code == code))
        if permission is None:
            permission = Permission(code=code, description=description)
            session.add(permission)
            session.flush()
        permissions[code] = permission

    groups = {}
    for name, description, codes in (
        (
            "Administradores de permissões",
            "Bootstrap local para administradores demo",
            (
                *CONTENT_WRITE_PERMISSIONS,
                "permissions.manage",
                "users.manage",
                "users.manage_admin",
            ),
        ),
        (
            "Gestores CEDOC",
            "Bootstrap local para gestão de usuários sem promoção administrativa",
            ("assets.write", "permissions.manage", "users.manage"),
        ),
        (
            "Operadores de conteúdo",
            "Bootstrap local com ações de conteúdo para os perfis demo",
            CONTENT_WRITE_PERMISSIONS,
        ),
    ):
        group = session.scalar(
            select(PermissionGroup).where(
                PermissionGroup.tenant_id == tenant.id,
                PermissionGroup.name == name,
            )
        )
        if group is None:
            group = PermissionGroup(tenant_id=tenant.id, name=name, description=description)
            session.add(group)
            session.flush()
        group.is_active = True
        group.permissions = [permissions[code] for code in codes]
        groups[name] = group

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
            session.add(
                Membership(
                    user_id=user.id,
                    tenant_id=tenant.id,
                    role=role,
                    permission_group_id=(
                        groups["Administradores de permissões"].id
                        if role in {"admin", "superadmin"}
                        else groups["Gestores CEDOC"].id
                        if role == "cedoc"
                        else groups["Operadores de conteúdo"].id
                    ),
                )
            )
        else:
            membership.role = role
            membership.is_active = True
            membership.permission_group_id = (
                groups["Administradores de permissões"].id
                if role in {"admin", "superadmin"}
                else groups["Gestores CEDOC"].id
                if role == "cedoc"
                else groups["Operadores de conteúdo"].id
            )

    session.commit()
    return {"created": created, "updated": updated, "tenant_id": str(tenant.id)}

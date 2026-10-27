import argparse
import os

from app.db.session import SessionLocal
from app.models.identity import (
    Membership,
    Permission,
    PermissionGroup,
    Tenant,
    User,
)
from app.security.passwords import hash_password
from app.tenancy.record_policies import PERMISSION_CATALOG
from sqlalchemy import select

TENANT_NAME = "MediaMind AI"
TENANT_SLUG = "mediamind"


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Variável obrigatória não definida: {name}")
    return value


def admin_password() -> str:
    password = required_env("BOOTSTRAP_ADMIN_PASSWORD")
    if len(password) < 12:
        raise SystemExit("BOOTSTRAP_ADMIN_PASSWORD deve ter pelo menos 12 caracteres.")
    return password


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap de produção do MediaMind AI.")
    parser.add_argument(
        "--reset-superadmin-password",
        action="store_true",
        help=(
            "Redefine a senha do superadmin existente com BOOTSTRAP_ADMIN_PASSWORD e "
            "desbloqueia a conta. Sem esta opção a senha só é definida na criação."
        ),
    )
    parser.add_argument(
        "--reactivate-superadmin",
        action="store_true",
        help=(
            "Reativa o superadmin (usuário, vínculo e suspensão legada da conta) se estiver "
            "suspenso. Sem esta opção "
            "(ou --reset-superadmin-password) uma suspensão é preservada a cada deploy."
        ),
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None, session_factory=SessionLocal) -> None:
    args = parse_args(argv)
    email = required_env("BOOTSTRAP_ADMIN_EMAIL").casefold()
    full_name = required_env("BOOTSTRAP_ADMIN_NAME")
    if args.reset_superadmin_password:
        admin_password()
    reactivate = args.reactivate_superadmin or args.reset_superadmin_password

    with session_factory() as session:
        # 1. Tenant
        tenant = session.scalar(select(Tenant).where(Tenant.slug == TENANT_SLUG))

        if tenant is None:
            tenant = Tenant(
                name=TENANT_NAME,
                slug=TENANT_SLUG,
                is_active=True,
            )
            session.add(tenant)
            session.flush()
            print("Tenant criado.")
        else:
            tenant.name = TENANT_NAME
            tenant.is_active = True
            print("Tenant existente reutilizado.")

        # 2. Catálogo completo de permissões (antes só as 3 administrativas: os códigos de
        # conteúdo não existiam em produção e toda gravação de conteúdo dava 403).
        permissions = []

        for code, description in PERMISSION_CATALOG.items():
            permission = session.scalar(select(Permission).where(Permission.code == code))

            if permission is None:
                permission = Permission(
                    code=code,
                    description=description,
                )
                session.add(permission)
                session.flush()

            permissions.append(permission)

        # 3. Grupo do Superadmin
        group = session.scalar(
            select(PermissionGroup).where(
                PermissionGroup.tenant_id == tenant.id,
                PermissionGroup.name == "Administradores de permissões",
            )
        )

        if group is None:
            group = PermissionGroup(
                tenant_id=tenant.id,
                name="Administradores de permissões",
                description="Administração completa do MediaMind AI",
                is_active=True,
            )
            session.add(group)
            session.flush()

        group.is_active = True
        # Add missing permissions without removing ones granted later by an admin.
        for permission in permissions:
            if permission not in group.permissions:
                group.permissions.append(permission)

        # 4. Usuário
        user = session.scalar(select(User).where(User.email_normalized == email))
        membership = (
            session.scalar(
                select(Membership).where(
                    Membership.user_id == user.id,
                    Membership.tenant_id == tenant.id,
                )
            )
            if user is not None
            else None
        )
        # A suspension (e.g. during an incident) must survive redeploys: only an explicit
        # flag brings the account back. Legacy suspensions live in ``account_status``.
        suspended = user is not None and (
            not user.is_active
            or user.account_status == "suspended"
            or (membership is not None and not membership.is_active)
        )
        keep_suspended = suspended and not reactivate

        if user is None:
            user = User(
                email=email,
                email_normalized=email,
                password_hash=hash_password(admin_password()),
                full_name=full_name,
                is_active=True,
            )
            session.add(user)
            session.flush()
            print("Usuário Superadmin criado.")
        else:
            user.email = email
            user.full_name = full_name
            if not keep_suspended:
                user.is_active = True
                if user.account_status == "suspended":
                    # Same as admin_users reactivation: also undo the legacy account flag.
                    user.account_status = "active"
            # Never rotate credentials silently on a redeploy: only on explicit request.
            if args.reset_superadmin_password:
                user.password_hash = hash_password(admin_password())
                user.failed_login_attempts = 0
                user.locked_until = None
                print("Usuário Superadmin existente atualizado; senha redefinida a pedido.")
            else:
                print("Usuário Superadmin existente atualizado (senha preservada).")

        # 5. Membership
        if keep_suspended:
            print(
                "Superadmin suspenso preservado (conta/vínculo inativos). "
                "Use --reactivate-superadmin para reativar."
            )
        elif membership is None:
            membership = Membership(
                user_id=user.id,
                tenant_id=tenant.id,
                role="superadmin",
                permission_group_id=group.id,
                is_active=True,
            )
            session.add(membership)
            print("Membership Superadmin criada.")
        else:
            membership.role = "superadmin"
            membership.permission_group_id = group.id
            membership.is_active = True
            print("Membership Superadmin atualizada.")

        session.commit()

        print("")
        print("Bootstrap de produção concluído.")
        print(f"Usuário: {email}")
        print(f"Tenant: {tenant.name}")
        print("Papel: superadmin")


if __name__ == "__main__":
    main()

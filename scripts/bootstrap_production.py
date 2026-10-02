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
from sqlalchemy import select

TENANT_NAME = "MediaMind AI"
TENANT_SLUG = "mediamind"


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Variável obrigatória não definida: {name}")
    return value


def main() -> None:
    email = required_env("BOOTSTRAP_ADMIN_EMAIL").casefold()
    full_name = required_env("BOOTSTRAP_ADMIN_NAME")
    password = required_env("BOOTSTRAP_ADMIN_PASSWORD")

    if len(password) < 12:
        raise SystemExit(
            "BOOTSTRAP_ADMIN_PASSWORD deve ter pelo menos 12 caracteres."
        )

    with SessionLocal() as session:
        # 1. Tenant
        tenant = session.scalar(
            select(Tenant).where(Tenant.slug == TENANT_SLUG)
        )

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

        # 2. Permissões administrativas
        permission_definitions = (
            (
                "permissions.manage",
                "Gerenciar grupos e atribuições de permissões",
            ),
            (
                "users.manage",
                "Gerenciar vínculos e cargos de usuários",
            ),
            (
                "users.manage_admin",
                "Conceder cargos administrativos",
            ),
        )

        permissions = []

        for code, description in permission_definitions:
            permission = session.scalar(
                select(Permission).where(Permission.code == code)
            )

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
        group.permissions = permissions

        # 4. Usuário
        user = session.scalar(
            select(User).where(User.email_normalized == email)
        )

        if user is None:
            user = User(
                email=email,
                email_normalized=email,
                password_hash=hash_password(password),
                full_name=full_name,
                is_active=True,
            )
            session.add(user)
            session.flush()
            print("Usuário Superadmin criado.")
        else:
            user.email = email
            user.full_name = full_name
            user.is_active = True
            user.password_hash = hash_password(password)
            user.failed_login_attempts = 0
            user.locked_until = None
            print("Usuário Superadmin existente atualizado.")

        # 5. Membership
        membership = session.scalar(
            select(Membership).where(
                Membership.user_id == user.id,
                Membership.tenant_id == tenant.id,
            )
        )

        if membership is None:
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

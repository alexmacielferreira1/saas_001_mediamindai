"""Semeia empresas e usuários exclusivos de uma execução E2E.

Lê a senha de ``E2E_PASSWORD`` (gerada aleatoriamente pelo ``scripts/e2e.ps1``) e o
identificador da execução de ``E2E_RUN_ID``. Nunca imprime a senha. Recusa rodar fora de
ENVIRONMENT=test ou contra um banco cujo nome não termine em ``_e2e``.
"""

import json
import os
from urllib.parse import urlsplit

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.identity import Membership, Permission, PermissionGroup, Tenant, User
from app.security.passwords import hash_password
from app.tenancy.record_policies import CONTENT_WRITE_PERMISSIONS, PERMISSION_CATALOG
from sqlalchemy import select

ADMIN_CODES = (*CONTENT_WRITE_PERMISSIONS, "permissions.manage", "users.manage")


def _guard() -> None:
    settings = get_settings()
    if settings.environment != "test":
        raise SystemExit("seed_e2e: ENVIRONMENT precisa ser 'test'.")
    db_name = urlsplit(settings.database_url.get_secret_value()).path.lstrip("/")
    if not db_name.endswith("_e2e"):
        raise SystemExit("seed_e2e: DATABASE_URL precisa apontar para um banco *_e2e.")


def _permissions(session) -> dict[str, Permission]:
    result = {}
    for code, description in PERMISSION_CATALOG.items():
        permission = session.scalar(select(Permission).where(Permission.code == code))
        if permission is None:
            permission = Permission(code=code, description=description)
            session.add(permission)
            session.flush()
        result[code] = permission
    return result


def _tenant_with_admin(session, permissions, *, run_id: str, key: str, password: str) -> dict:
    tenant = Tenant(name=f"E2E Empresa {key.upper()} {run_id}", slug=f"e2e-{key}-{run_id}")
    session.add(tenant)
    session.flush()
    group = PermissionGroup(
        tenant_id=tenant.id,
        name="Administradores E2E",
        description="Grupo criado pelo teste E2E",
    )
    group.permissions = [permissions[code] for code in ADMIN_CODES]
    session.add(group)
    session.flush()
    email = f"e2e-{key}-{run_id}@mediamind-e2e.local"
    user = User(
        email=email,
        email_normalized=email.casefold(),
        password_hash=hash_password(password),
        full_name=f"Usuário E2E {key.upper()}",
    )
    session.add(user)
    session.flush()
    session.add(
        Membership(user_id=user.id, tenant_id=tenant.id, role="admin", permission_group_id=group.id)
    )
    return {"email": email, "tenant_id": str(tenant.id), "tenant_name": tenant.name}


def main() -> None:
    _guard()
    password = os.environ.get("E2E_PASSWORD", "")
    run_id = os.environ.get("E2E_RUN_ID", "")
    if len(password) < 16 or not run_id.isalnum():
        raise SystemExit("seed_e2e: defina E2E_PASSWORD (>=16) e E2E_RUN_ID alfanumérico.")
    with SessionLocal() as session:
        permissions = _permissions(session)
        accounts = {
            key: _tenant_with_admin(session, permissions, run_id=run_id, key=key, password=password)
            for key in ("a", "b")
        }
        session.commit()
    # Somente identificadores públicos de teste; a senha nunca é gravada.
    print(json.dumps({"run_id": run_id, "accounts": accounts}))


if __name__ == "__main__":
    main()

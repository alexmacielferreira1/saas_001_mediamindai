"""Apoio aos testes da revisão geral de 2026-10-24 (membros com permissões específicas)."""

from app.models.identity import Membership, Permission, PermissionGroup, User
from app.security.passwords import hash_password
from sqlalchemy import select
from test_permission_groups_api import PASSWORD


def add_member(ids, email, codes, *, tenant_key="tenant", role="editor"):
    """Cria um membro com um grupo que concede exatamente ``codes`` na empresa indicada."""
    with ids["session_factory"]() as session:
        tenant_id = ids[tenant_key]
        user = User(email=email, email_normalized=email, password_hash=hash_password(PASSWORD))
        group = PermissionGroup(tenant_id=tenant_id, name=f"Grupo {email}")
        session.add_all([user, group])
        session.flush()
        group.permissions.extend(
            session.scalars(select(Permission).where(Permission.code.in_(codes))).all()
        )
        session.add(
            Membership(
                user_id=user.id, tenant_id=tenant_id, role=role, permission_group_id=group.id
            )
        )
        session.commit()
        return user.id


def login_as(client, email):
    client.post("/api/v1/auth/logout")
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text

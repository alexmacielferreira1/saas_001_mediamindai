from types import SimpleNamespace
from uuid import uuid4

import pytest
from app.core.errors import PublicError
from app.db.session import Base
from app.models.identity import Membership, Permission, PermissionGroup, Tenant, User
from app.security.passwords import hash_password
from app.tenancy.context import CurrentSession
from app.tenancy.permissions import effective_permissions, require_permission
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def permission_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    with testing_session() as session:
        tenant = Tenant(name="Empresa", slug="empresa")
        other_tenant = Tenant(name="Outra", slug="outra")
        user = User(
            email="editor@mediamind.ai",
            email_normalized="editor@mediamind.ai",
            password_hash=hash_password("senha-local-segura"),
        )
        session.add_all([tenant, other_tenant, user])
        session.flush()
        membership = Membership(
            user_id=user.id,
            tenant_id=tenant.id,
            role="editor",
        )
        session.add(membership)
        session.commit()
        yield session, user, tenant, other_tenant, membership
    Base.metadata.drop_all(engine)
    engine.dispose()


def current_for(user, tenant, membership):
    return CurrentSession(
        auth_session=None,
        user=user,
        membership=membership,
        tenant=tenant,
    )


def test_superadmin_sees_the_whole_catalog_only_in_its_own_tenant(permission_session):
    # Checagens que leem effective_permissions direto (auditoria, IA) concordam com
    # require_permission; um vínculo de outra empresa não vale como superadmin aqui.
    session, user, tenant, other_tenant, membership = permission_session
    session.add_all([Permission(code="assets.write"), Permission(code="users.manage")])
    membership.role = "superadmin"
    session.commit()

    assert effective_permissions(session, current_for(user, tenant, membership)) == {
        "assets.write",
        "users.manage",
    }
    forged = current_for(user, other_tenant, membership)
    assert effective_permissions(session, forged) == set()
    with pytest.raises(PublicError):
        require_permission(session, forged, "assets.write")


def test_permissions_deny_by_default(permission_session):
    session, user, tenant, _, membership = permission_session

    assert effective_permissions(session, current_for(user, tenant, membership)) == set()

    with pytest.raises(PublicError) as exc:
        require_permission(
            session,
            current_for(user, tenant, membership),
            "assets.publish",
        )
    assert exc.value.status == 403
    assert exc.value.code == "PERMISSION_DENIED"


def test_active_group_grants_permission_in_selected_tenant(permission_session):
    session, user, tenant, _, membership = permission_session
    permission = Permission(code="assets.publish", description="Publicar ativos")
    group = PermissionGroup(tenant_id=tenant.id, name="Publicadores")
    session.add_all([permission, group])
    session.flush()
    group.permissions.append(permission)
    membership.permission_group_id = group.id
    session.commit()

    current = current_for(user, tenant, membership)

    assert effective_permissions(session, current) == {"assets.publish"}
    assert require_permission(session, current, "assets.publish") is current


@pytest.mark.parametrize("reason", ["inactive", "other_tenant"])
def test_group_does_not_leak_permission(permission_session, reason):
    session, user, tenant, other_tenant, membership = permission_session
    permission = Permission(code="users.manage", description="Gerenciar usuários")
    group = PermissionGroup(
        tenant_id=other_tenant.id if reason == "other_tenant" else tenant.id,
        name="Gestores",
        is_active=reason != "inactive",
    )
    session.add_all([permission, group])
    session.flush()
    group.permissions.append(permission)
    membership.permission_group_id = group.id
    session.commit()

    assert effective_permissions(session, current_for(user, tenant, membership)) == set()


def test_permission_requires_selected_membership(permission_session):
    session, user, _, _, _ = permission_session
    current = CurrentSession(auth_session=None, user=user, membership=None, tenant=None)

    with pytest.raises(PublicError) as exc:
        require_permission(session, current, "assets.read")
    assert exc.value.code == "TENANT_ACCESS_DENIED"


def test_superadmin_is_granted_every_permission_in_the_selected_tenant(permission_session):
    # Decisão de 27/10/2026 (DECISIONS.md): superadmin tem acesso total na própria empresa,
    # sem depender do grupo de permissões. Antes ele precisava de um grupo com cada código.
    session, user, tenant, _, membership = permission_session
    membership.role = "superadmin"
    membership.permission_group_id = None
    session.commit()

    current = current_for(user, tenant, membership)

    assert require_permission(session, current, "assets.write") is current
    assert require_permission(session, current, "unknown.execute") is current


def test_permission_context_rejects_inconsistent_membership(permission_session):
    session, user, tenant, _, _ = permission_session
    forged_membership = SimpleNamespace(
        id=uuid4(), tenant_id=uuid4(), permission_group_id=None, role="editor"
    )

    assert (
        effective_permissions(
            session,
            current_for(user, tenant, forged_membership),
        )
        == set()
    )

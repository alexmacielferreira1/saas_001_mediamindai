import importlib.util
from pathlib import Path

import pytest
from app.db.session import Base
from app.models.identity import Membership, Permission, PermissionGroup, Tenant, User
from app.tenancy.record_policies import PERMISSION_CATALOG
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "alembic"
    / "versions"
    / "0010_default_permission_groups.py"
)


@pytest.fixture
def migration():
    spec = importlib.util.spec_from_file_location("migration_0010", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def production_like():
    """Estado do banco publicado: só os 3 códigos do bootstrap e vínculos sem grupo."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        tenant = Tenant(name="MediaMind AI", slug="mediamind")
        other = Tenant(name="Outra", slug="outra")
        session.add_all([tenant, other])
        session.flush()
        admin_codes = [
            Permission(code=code, description=PERMISSION_CATALOG[code])
            for code in ("permissions.manage", "users.manage", "users.manage_admin")
        ]
        bootstrap_group = PermissionGroup(
            tenant_id=tenant.id,
            name="Administradores de permissões",
            description="Administração completa do MediaMind AI",
        )
        bootstrap_group.permissions = admin_codes
        custom = PermissionGroup(
            tenant_id=tenant.id, name="Grupo da empresa", description="criado por um gestor"
        )
        custom.permissions = [admin_codes[1]]
        session.add_all([*admin_codes, bootstrap_group, custom])
        session.flush()
        people = {}
        for email, role, group in (
            ("super@x.com", "superadmin", bootstrap_group),
            ("editor@x.com", "editor", None),
            ("cedoc@x.com", "cedoc", None),
            ("leitor@x.com", "viewer", None),
            ("custom@x.com", "editor", custom),
            ("admin2@x.com", "admin", None),
        ):
            user = User(email=email, email_normalized=email, password_hash="x", full_name=email)
            session.add(user)
            session.flush()
            target = other if email == "admin2@x.com" else tenant
            session.add(
                Membership(
                    user_id=user.id,
                    tenant_id=target.id,
                    role=role,
                    permission_group_id=group.id if group else None,
                )
            )
            people[email] = user.id
        session.commit()
        ids = {
            "tenant": tenant.id,
            "other": other.id,
            "custom": custom.id,
            "bootstrap": bootstrap_group.id,
            **people,
        }
    yield engine, ids
    engine.dispose()


def codes_of(session, email):
    membership = session.scalar(select(Membership).join(User).where(User.email == email))
    if membership.permission_group_id is None:
        return None
    group = session.get(PermissionGroup, membership.permission_group_id)
    return sorted(permission.code for permission in group.permissions)


def run(engine, fn):
    with engine.begin() as connection:
        fn(connection)


def test_upgrade_creates_catalog_and_gives_each_role_its_default_group(migration, production_like):
    engine, ids = production_like
    run(engine, migration.apply_defaults)

    with Session(engine) as session:
        assert sorted(session.scalars(select(Permission.code))) == sorted(PERMISSION_CATALOG)
        everything = sorted(PERMISSION_CATALOG)
        # O grupo do bootstrap ganha os códigos de conteúdo e mantém os administrativos.
        assert codes_of(session, "super@x.com") == everything
        assert codes_of(session, "editor@x.com") == sorted(migration.CONTENT)
        assert codes_of(session, "cedoc@x.com") == [
            "assets.write",
            "permissions.manage",
            "users.manage",
        ]
        # Somente leitura continua sem grupo; vínculo com grupo escolhido pela empresa não muda.
        assert codes_of(session, "leitor@x.com") is None
        assert codes_of(session, "custom@x.com") == ["users.manage"]
        # Outra empresa recebe os próprios grupos-padrão (isolamento por tenant).
        assert codes_of(session, "admin2@x.com") == everything
        other_groups = session.scalars(
            select(PermissionGroup).where(PermissionGroup.tenant_id == ids["other"])
        ).all()
        assert {group.name for group in other_groups} == {name for name, _, _ in migration.GROUPS}
        assert all(group.tenant_id == ids["other"] for group in other_groups)


def test_upgrade_is_idempotent(migration, production_like):
    engine, _ids = production_like
    run(engine, migration.apply_defaults)
    with Session(engine) as session:
        before = (session.query(PermissionGroup).count(), session.query(Permission).count())
    run(engine, migration.apply_defaults)
    with Session(engine) as session:
        assert (session.query(PermissionGroup).count(), session.query(Permission).count()) == before


def test_downgrade_removes_only_the_groups_it_created(migration, production_like):
    engine, ids = production_like
    run(engine, migration.apply_defaults)
    run(engine, migration.remove_defaults)
    run(engine, migration.remove_defaults)

    with Session(engine) as session:
        names = {group.name for group in session.scalars(select(PermissionGroup))}
        assert names == {"Administradores de permissões", "Grupo da empresa"}
        assert codes_of(session, "editor@x.com") is None
        assert codes_of(session, "custom@x.com") == ["users.manage"]
        assert session.get(PermissionGroup, ids["bootstrap"]) is not None
        assert codes_of(session, "super@x.com") == sorted(PERMISSION_CATALOG)


def test_existing_group_with_a_default_name_is_left_as_the_company_configured(
    migration, production_like
):
    engine, ids = production_like
    with Session(engine) as session:
        session.add(
            PermissionGroup(
                tenant_id=ids["tenant"], name="Operadores de conteúdo", description="da empresa"
            )
        )
        session.commit()
    run(engine, migration.apply_defaults)
    with Session(engine) as session:
        group = session.scalar(
            select(PermissionGroup).where(
                PermissionGroup.tenant_id == ids["tenant"],
                PermissionGroup.name == "Operadores de conteúdo",
            )
        )
        assert group.permissions == []
        assert group.description == "da empresa"
        # Ninguém é vinculado a um grupo da empresa só por ter o nome de um padrão.
        assert codes_of(session, "editor@x.com") is None
        assert codes_of(session, "cedoc@x.com") == [
            "assets.write",
            "permissions.manage",
            "users.manage",
        ]


def test_company_group_with_default_name_and_admin_codes_is_not_inherited(
    migration, production_like
):
    engine, ids = production_like
    with Session(engine) as session:
        powerful = PermissionGroup(
            tenant_id=ids["tenant"], name="Gestores CEDOC", description="da empresa"
        )
        powerful.permissions = list(session.scalars(select(Permission)))
        session.add(powerful)
        session.commit()
    run(engine, migration.apply_defaults)
    with Session(engine) as session:
        assert codes_of(session, "cedoc@x.com") is None


def test_inactive_admin_group_is_not_reused(migration, production_like):
    engine, ids = production_like
    with Session(engine) as session:
        session.get(PermissionGroup, ids["bootstrap"]).is_active = False
        session.commit()
    run(engine, migration.apply_defaults)
    with Session(engine) as session:
        bootstrap = session.get(PermissionGroup, ids["bootstrap"])
        assert bootstrap.is_active is False
        assert sorted(p.code for p in bootstrap.permissions) == [
            "permissions.manage",
            "users.manage",
            "users.manage_admin",
        ]
        # O admin da outra empresa continua recebendo o grupo-padrão dela.
        assert codes_of(session, "admin2@x.com") == sorted(PERMISSION_CATALOG)


@pytest.mark.parametrize(
    ("role", "expected"),
    [
        ("viewer", None),
        ("cargo_legado", None),
        ("admin", "Administradores de permissões"),
        ("superadmin", "Administradores de permissões"),
        ("cedoc", "Gestores CEDOC"),
        ("reporter", "Operadores de conteúdo"),
        ("mvp", "Operadores de conteúdo"),
    ],
)
def test_default_group_for_role(migration, role, expected):
    assert migration.default_group_for(role) == expected

import pytest
from app.db.session import Base, get_session
from app.main import create_app
from app.models.identity import Membership, Tenant, TenantRecord, User
from app.security.passwords import hash_password
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

PASSWORD = "senha-local-segura"


@pytest.fixture
def management_client():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as session:
        tenant = Tenant(name="Empresa", slug="empresa")
        other = Tenant(name="Outra", slug="outra")
        admin = User(
            email="admin@local.test",
            email_normalized="admin@local.test",
            password_hash=hash_password(PASSWORD),
        )
        viewer = User(
            email="viewer@local.test",
            email_normalized="viewer@local.test",
            password_hash=hash_password(PASSWORD),
        )
        session.add_all([tenant, other, admin, viewer])
        session.flush()
        session.add_all(
            [
                Membership(user_id=admin.id, tenant_id=tenant.id, role="admin"),
                Membership(user_id=viewer.id, tenant_id=tenant.id, role="viewer"),
                TenantRecord(
                    tenant_id=tenant.id,
                    entity_type="Publicacao",
                    data={
                        "titulo": "No ar",
                        "status": "Publicado",
                        "data_agendada": "2026-09-20",
                        "plataforma": "instagram",
                    },
                ),
                TenantRecord(
                    tenant_id=tenant.id,
                    entity_type="Publicacao",
                    data={
                        "title": "Depois",
                        "situacao": "scheduled",
                        "scheduled_at": "2026-09-21",
                        "platform": "youtube",
                    },
                ),
                TenantRecord(tenant_id=tenant.id, entity_type="Publicacao", data={}),
                TenantRecord(
                    tenant_id=tenant.id,
                    entity_type="Asset",
                    data={"status": "Indexado", "file_size": 20},
                ),
                TenantRecord(
                    tenant_id=tenant.id,
                    entity_type="Asset",
                    data={"situacao": "failed", "size": "30"},
                ),
                TenantRecord(
                    tenant_id=tenant.id,
                    entity_type="ProcessamentoJob",
                    data={"status": "processing"},
                ),
                TenantRecord(
                    tenant_id=tenant.id,
                    entity_type="ProcessamentoJob",
                    data={"status": "completed"},
                ),
                TenantRecord(
                    tenant_id=tenant.id, entity_type="ProcessamentoJob", data={"status": "failed"}
                ),
                TenantRecord(tenant_id=tenant.id, entity_type="LogAuditoria", data={}),
                TenantRecord(
                    tenant_id=other.id,
                    entity_type="Asset",
                    data={"status": "Indexado", "size": 999},
                ),
            ]
        )
        session.commit()

    def override_session():
        with factory() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, factory
    Base.metadata.drop_all(engine)
    engine.dispose()


def login(client, email):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def test_management_requires_authentication(management_client):
    client, _ = management_client
    assert client.get("/api/v1/management/overview").status_code == 401


def test_management_rejects_non_manager(management_client):
    client, _ = management_client
    login(client, "viewer@local.test")
    response = client.get("/api/v1/management/overview")
    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"


def test_management_returns_real_tenant_aggregates(management_client):
    client, _ = management_client
    login(client, "admin@local.test")
    response = client.get("/api/v1/management/overview")
    assert response.status_code == 200
    body = response.json()
    assert body["publications"] == {
        "published": 1,
        "scheduled": 1,
        "pending": 1,
        "approval_rate": 50,
        "calendar": [
            {
                "id": body["publications"]["calendar"][0]["id"],
                "title": "Publicação",
                "date": "",
                "platform": "",
                "status": "Pendente",
            },
            {
                "id": body["publications"]["calendar"][1]["id"],
                "title": "No ar",
                "date": "2026-09-20",
                "platform": "instagram",
                "status": "Publicado",
            },
            {
                "id": body["publications"]["calendar"][2]["id"],
                "title": "Depois",
                "date": "2026-09-21",
                "platform": "youtube",
                "status": "scheduled",
            },
        ],
    }
    assert body["social_metrics"] == []
    assert body["assets"] == {"total": 2, "indexed": 1, "failures": 1, "storage_bytes": 50}
    assert body["processing"] == {"total": 3, "active": 1, "completed": 1, "failed": 1}
    assert body["audit_events"] == 1
    assert body["services"] == [
        {"key": "api", "label": "API local", "status": "ok", "detail": "Operacional"},
        {"key": "database", "label": "Banco de dados", "status": "ok", "detail": "Operacional"},
    ]


def test_management_zero_denominator_and_superadmin_access(management_client):
    client, factory = management_client
    with factory() as session:
        tenant = session.query(Tenant).filter_by(slug="empresa").one()
        superadmin = User(
            email="super@local.test",
            email_normalized="super@local.test",
            password_hash=hash_password(PASSWORD),
        )
        session.add(superadmin)
        session.flush()
        session.add(Membership(user_id=superadmin.id, tenant_id=tenant.id, role="superadmin"))
        for row in session.query(TenantRecord).filter_by(
            tenant_id=tenant.id, entity_type="Publicacao"
        ):
            session.delete(row)
        session.commit()
    login(client, "super@local.test")
    body = client.get("/api/v1/management/overview").json()
    assert body["publications"]["approval_rate"] == 0
    assert body["publications"]["calendar"] == []

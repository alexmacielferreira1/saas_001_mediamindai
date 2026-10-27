"""Auditoria 2026-10-23, achado #8: dashboard e Gestão não carregam todas as linhas da empresa.

Contagens vão para o SQL (GROUP BY / COUNT) e só as entidades exibidas em detalhe são
carregadas; trilha de auditoria e eventos de uso nunca são lidos linha a linha.
"""

# ruff: noqa: F811

import importlib.util
from contextlib import contextmanager

from alembic.config import Config
from alembic.script import ScriptDirectory
from app.core.config import ROOT
from app.models.identity import TenantRecord
from sqlalchemy import event
from test_permission_groups_api import login, permission_client  # noqa: F401


@contextmanager
def loaded_entity_types():
    loaded = []

    def on_load(target, _context):
        loaded.append(target.entity_type)

    event.listen(TenantRecord, "load", on_load)
    try:
        yield loaded
    finally:
        event.remove(TenantRecord, "load", on_load)


def seed(ids):
    rows = [
        ("ProducaoProjeto", {"etapa": "em_edicao", "project_id": "p1"}),
        ("ProducaoProjeto", {"etapa": "finalizado", "project_id": "p2"}),
        ("ProducaoProjeto", {"etapa": "finalizado", "project_id": ""}),
        ("Script", {"project_id": "p1"}),
        ("AprovacaoItem", {}),
        ("AprovacaoVersao", {}),
        ("ProcessamentoJob", {"status": "queued"}),
        ("Publicacao", {"status": "publicado"}),
        ("PendenciaCorp", {}),
        ("AgendaEvento", {"titulo": "B", "horario": "11:00", "day": 2, "status": "x"}),
        ("AgendaEvento", {"titulo": "A", "horario": "09:00", "day": 1, "status": "x"}),
        ("Asset", {"status": "indexado", "file_size": 10}),
    ]
    rows += [("LogAuditoria", {"action": "record.updated"})] * 40
    rows += [("AIUsageEvent", {"feature": "copilot.chat"})] * 20
    with ids["session_factory"]() as session:
        session.add_all(
            TenantRecord(tenant_id=ids["tenant"], entity_type=entity, data=dict(data))
            for entity, data in rows
        )
        session.add(
            TenantRecord(
                tenant_id=ids["other"], entity_type="ProducaoProjeto", data={"project_id": "x"}
            )
        )
        session.commit()


def test_dashboard_counts_in_sql_without_loading_audit_rows(permission_client):
    client, ids = permission_client
    seed(ids)
    login(client)

    with loaded_entity_types() as loaded:
        response = client.get("/api/v1/dashboard/me")

    assert response.status_code == 200
    kpis = {item["id"]: item["value"] for item in response.json()["kpis"]}
    assert kpis == {
        "productions": 3,
        "finished": 2,
        "editing": 1,
        "approvals": 2,
        "processing": 1,
        "publications": 1,
        "pending": 1,
        "projects": 2,
    }
    assert [item["title"] for item in response.json()["upcoming_events"]] == ["A", "B"]
    assert set(loaded) <= {"AgendaEvento"}


def test_management_counts_in_sql_without_loading_audit_rows(permission_client):
    client, ids = permission_client
    seed(ids)
    login(client)

    with loaded_entity_types() as loaded:
        response = client.get("/api/v1/management/overview")

    assert response.status_code == 200
    body = response.json()
    assert body["audit_events"] == 40
    assert body["assets"]["total"] == 1
    assert body["processing"]["total"] == 1
    assert body["publications"]["published"] == 1
    assert set(loaded) <= {"Publicacao", "Asset", "ProcessamentoJob"}


def test_tenant_records_have_composite_listing_index():
    indexes = {
        tuple(column.name for column in index.columns) for index in TenantRecord.__table__.indexes
    }
    assert ("tenant_id", "entity_type", "created_at") in indexes


class RecordingOp:
    def __init__(self):
        self.calls = []

    def get_context(self):
        recorder = self

        class Context:
            @contextmanager
            def autocommit_block(self):
                recorder.calls.append(("autocommit_block",))
                yield

        return Context()

    def __getattr__(self, name):
        def record(*args, **kwargs):
            self.calls.append((name, args, kwargs))

        return record


def test_index_migration_only_creates_the_composite_index():
    script = ScriptDirectory.from_config(Config(str(ROOT / "alembic.ini")))
    # alembic_version.version_num é VARCHAR(32) no PostgreSQL.
    assert len(script.get_current_head()) <= 32
    head = script.get_revision("0009_tenant_records_list_index")
    spec = importlib.util.spec_from_file_location("index_migration", head.path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    recorder = RecordingOp()
    module.op = recorder

    module.upgrade()

    operations = [call for call in recorder.calls if call[0] != "autocommit_block"]
    assert [call[0] for call in operations] == ["create_index"]
    _name, args, kwargs = operations[0]
    assert args[1] == "tenant_records"
    assert list(args[2]) == ["tenant_id", "entity_type", "created_at"]
    assert kwargs.get("if_not_exists") is True


def test_record_listing_sorted_by_date_is_limited_in_sql(permission_client):
    from datetime import UTC, datetime, timedelta

    client, ids = permission_client
    base = datetime(2026, 1, 1, tzinfo=UTC)
    with ids["session_factory"]() as session:
        session.add_all(
            TenantRecord(
                tenant_id=ids["tenant"],
                entity_type="Script",
                data={"n": index},
                created_at=base + timedelta(minutes=index),
                updated_at=base + timedelta(minutes=60 - index),
            )
            for index in range(60)
        )
        session.commit()
    login(client)

    with loaded_entity_types() as loaded:
        newest = client.get("/api/v1/records/Script", params={"limit": 5})
        oldest = client.get("/api/v1/records/Script", params={"limit": 3, "sort": "created_date"})
        by_update = client.get(
            "/api/v1/records/Script", params={"limit": 2, "sort": "-updated_date"}
        )

    assert [item["n"] for item in newest.json()["records"]] == [59, 58, 57, 56, 55]
    assert [item["n"] for item in oldest.json()["records"]] == [0, 1, 2]
    assert [item["n"] for item in by_update.json()["records"]] == [0, 1]
    assert loaded.count("Script") == 5 + 3 + 2

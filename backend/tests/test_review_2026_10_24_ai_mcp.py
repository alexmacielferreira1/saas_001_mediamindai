# ruff: noqa: F811
"""Revisão geral 2026-10-24: política de IA nos cortes, permissão e fila do MCP."""

from datetime import UTC, datetime, timedelta

import pytest
from app.models.identity import TenantRecord
from review_helpers import add_member, login_as
from test_clips_api_error_paths import _candidate
from test_permission_groups_api import login, permission_client  # noqa: F401

CONNECTION = {
    "id": "remota",
    "provider": "compatible",
    "base_url": "https://api.example.test/v1",
    "model": "gpt-4o",
    "transcription_model": "whisper-1",
    "enabled": True,
    "encrypted_key": "cifrada",
}


def seed_clip_source(ids, media_root, *, policy=None, events=()):
    source = media_root / str(ids["tenant"]) / "asset" / "source.mp4"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"video")
    with ids["session_factory"]() as session:
        asset = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="Asset",
            data={"filename": "entrevista.mp4", "storage_key": f"{ids['tenant']}/asset/source.mp4"},
        )
        session.add(asset)
        session.add(
            TenantRecord(
                tenant_id=ids["tenant"],
                entity_type="AISettings",
                data={"connections": [CONNECTION]},
            )
        )
        if policy is not None:
            session.add(
                TenantRecord(tenant_id=ids["tenant"], entity_type="AIUsagePolicy", data=policy)
            )
        for event in events:
            session.add(TenantRecord(tenant_id=ids["tenant"], entity_type="AIUsageEvent", **event))
        session.commit()
        return asset.id


@pytest.fixture
def remote_adapters(monkeypatch):
    segment, candidate = _candidate()
    calls = []

    class FakeTranscription:
        def __init__(self, connection, api_key):
            self.connection = connection

        def transcribe(self, _path):
            calls.append("transcribe")
            return [segment]

    class FakeAnalysis:
        def __init__(self, connection, api_key):
            self.usage = {"prompt_tokens": 1200, "completion_tokens": 300}

        def suggest(self, _segments, **_kwargs):
            calls.append("suggest")
            return [candidate]

    monkeypatch.setattr("app.api.v1.clips.decrypt_ai_key", lambda _connection: "chave-real")
    monkeypatch.setattr("app.api.v1.clips.RemoteTranscriptionAdapter", FakeTranscription)
    monkeypatch.setattr("app.api.v1.clips.RemoteAnalysisAdapter", FakeAnalysis)
    return calls, FakeTranscription, FakeAnalysis


def usage_events(ids):
    with ids["session_factory"]() as session:
        return [
            row.data
            for row in session.query(TenantRecord).filter_by(entity_type="AIUsageEvent").all()
            if row.data.get("feature", "").startswith("auto-clips")
        ]


def analyses(ids):
    with ids["session_factory"]() as session:
        return session.query(TenantRecord).filter_by(entity_type="ClipAnalysis").count()


# --- Média 6: cortes com IA respeitam a política da empresa e registram uso -----------


def test_clip_analysis_with_ai_disabled_does_not_call_the_provider(
    permission_client, media_root, remote_adapters
):
    client, ids = permission_client
    login(client)
    asset_id = seed_clip_source(ids, media_root, policy={"enabled": False})
    calls, *_ = remote_adapters

    response = client.post(
        "/api/v1/clips/analyses", json={"asset_id": str(asset_id), "connection_id": "remota"}
    )

    assert response.status_code == 403
    assert response.json()["error_code"] == "AI_DISABLED"
    assert calls == []
    assert analyses(ids) == 0


def test_clip_analysis_over_the_request_budget_does_not_call_the_provider(
    permission_client, media_root, remote_adapters
):
    client, ids = permission_client
    login(client)
    policy = {
        "per_request_limit_usd": 0.001,
        "prices": [
            {
                "provider": "compatible",
                "model": "gpt-4o",
                "input_per_million_usd": 1000,
                "output_per_million_usd": 1000,
            }
        ],
    }
    asset_id = seed_clip_source(ids, media_root, policy=policy)
    calls, *_ = remote_adapters

    response = client.post(
        "/api/v1/clips/analyses", json={"asset_id": str(asset_id), "connection_id": "remota"}
    )

    assert response.status_code == 429
    assert response.json()["error_code"] == "AI_REQUEST_BUDGET"
    assert calls == []
    assert analyses(ids) == 0


def test_clip_analysis_records_usage_of_each_provider_call(
    permission_client, media_root, remote_adapters
):
    client, ids = permission_client
    login(client)
    asset_id = seed_clip_source(ids, media_root)

    response = client.post(
        "/api/v1/clips/analyses", json={"asset_id": str(asset_id), "connection_id": "remota"}
    )

    assert response.status_code == 202
    assert response.json()["status"] == "completed"
    events = sorted(usage_events(ids), key=lambda item: item["feature"])
    assert [(item["feature"], item["model"], item["status"]) for item in events] == [
        ("auto-clips.analysis", "gpt-4o", "ok"),
        ("auto-clips.transcription", "whisper-1", "ok"),
    ]
    assert events[0]["input_tokens"] == 1200 and events[0]["output_tokens"] == 300
    assert events[0]["connection_id"] == "remota"
    assert "chave-real" not in response.text


def test_clip_analysis_records_failed_provider_call(
    permission_client, media_root, remote_adapters, monkeypatch
):
    from app.clips.transcription import TranscriptionUnavailable

    client, ids = permission_client
    login(client)
    asset_id = seed_clip_source(ids, media_root)
    _calls, _transcription, analysis = remote_adapters

    def refuse(self, _segments, **_kwargs):
        raise TranscriptionUnavailable("A IA selecionada não conseguiu propor cortes.")

    monkeypatch.setattr(analysis, "suggest", refuse)
    response = client.post(
        "/api/v1/clips/analyses", json={"asset_id": str(asset_id), "connection_id": "remota"}
    )

    assert response.status_code == 202
    assert response.json()["status"] == "unavailable"
    statuses = {item["feature"]: item["status"] for item in usage_events(ids)}
    assert statuses == {"auto-clips.transcription": "ok", "auto-clips.analysis": "error"}


def test_clip_analysis_without_provider_usage_marks_usage_unknown(
    permission_client, media_root, remote_adapters, monkeypatch
):
    client, ids = permission_client
    login(client)
    asset_id = seed_clip_source(ids, media_root)
    _calls, _transcription, analysis = remote_adapters
    original_init = analysis.__init__

    def no_usage(self, connection, api_key):
        original_init(self, connection, api_key)
        self.usage = {}

    monkeypatch.setattr(analysis, "__init__", no_usage)
    response = client.post(
        "/api/v1/clips/analyses", json={"asset_id": str(asset_id), "connection_id": "remota"}
    )

    assert response.status_code == 202
    analysis_event = next(
        item for item in usage_events(ids) if item["feature"] == "auto-clips.analysis"
    )
    assert analysis_event["usage_known"] is False


def test_remote_analysis_adapter_exposes_provider_token_usage(monkeypatch):
    from app.clips import analysis as module

    segment, _candidate_value = _candidate()

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [{"message": {"content": '{"candidates": []}'}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 2},
            }

    monkeypatch.setattr(module.httpx, "post", lambda *_args, **_kwargs: Response())
    adapter = module.RemoteAnalysisAdapter(CONNECTION, "chave")

    assert adapter.suggest([segment]) == []
    assert adapter.usage == {"prompt_tokens": 10, "completion_tokens": 2}


# --- Média 7: ferramentas de IA do MCP exigem permissão de produção --------------------


def test_member_without_production_permission_cannot_spend_ai_through_mcp(
    permission_client, monkeypatch
):
    client, ids = permission_client
    add_member(ids, "sem-grupo@mediamind.ai", [])
    login_as(client, "sem-grupo@mediamind.ai")
    called = []

    async def fake_run_tool(*args, **kwargs):
        called.append(args)
        return {"text": "gerado"}

    monkeypatch.setattr("app.api.v1.mcp.run_tool", fake_run_tool)
    direct = client.post(
        "/api/v1/mcp/tools/ai-tools.prompt/call", json={"arguments": {"prompt": "x"}}
    )
    queued = client.post(
        "/api/v1/mcp/queues",
        json={
            "name": "Fila",
            "module": "ai-tools",
            "tool_name": "ai-tools.video_studio",
            "instruction": "Roteiro",
            "output_mode": "internal",
            "execution_mode": "immediate",
        },
    )
    inspect = client.post("/api/v1/mcp/tools/system.capabilities/call", json={"arguments": {}})

    assert direct.status_code == 403
    assert direct.json()["error_code"] == "PERMISSION_DENIED"
    assert queued.status_code == 403
    assert called == [] or all(args[2] == "system.capabilities" for args in called)
    assert inspect.status_code == 200


def test_member_with_production_permission_can_use_mcp_ai(permission_client, monkeypatch):
    client, ids = permission_client
    add_member(ids, "produtor@mediamind.ai", ["production.write"])
    login_as(client, "produtor@mediamind.ai")

    async def fake_run_tool(*_args, **_kwargs):
        return {"text": "gerado"}

    monkeypatch.setattr("app.api.v1.mcp.run_tool", fake_run_tool)
    response = client.post(
        "/api/v1/mcp/tools/ai-tools.prompt/call", json={"arguments": {"prompt": "x"}}
    )

    assert response.status_code == 200


def test_executing_a_queued_ai_job_requires_production_permission(permission_client):
    client, ids = permission_client
    login(client)
    created = client.post(
        "/api/v1/mcp/queues",
        json={
            "name": "Fila IA",
            "module": "ai-tools",
            "tool_name": "ai-tools.prompt",
            "instruction": "Resumo",
            "output_mode": "internal",
            "execution_mode": "queue",
        },
    )
    assert created.status_code == 201
    add_member(ids, "sem-grupo@mediamind.ai", [])
    login_as(client, "sem-grupo@mediamind.ai")

    response = client.post(f"/api/v1/mcp/queues/{created.json()['id']}/execute")

    assert response.status_code == 403


# --- Média 8: fila MCP não roda duas vezes; parcial refaz só o que falhou --------------


def make_queue(client, targets, mode="queue"):
    response = client.post(
        "/api/v1/mcp/queues",
        json={
            "name": "Lote",
            "module": "mmfilm",
            "tool_name": "mmfilm.inspect",
            "instruction": "Inspecionar.",
            "output_mode": "internal",
            "execution_mode": mode,
            "targets": targets,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_running_queue_is_not_executed_again(permission_client, monkeypatch):
    client, ids = permission_client
    login(client)
    queue = make_queue(client, [{"id": "EP01", "name": "EP01", "asset_ids": []}])
    with ids["session_factory"]() as session:
        row = session.get(TenantRecord, __import__("uuid").UUID(queue["id"]))
        row.data = {**row.data, "status": "running"}
        session.commit()
    executed = []

    async def fake_run_tool(*args, **_kwargs):
        executed.append(args)
        return {"asset_count": 0}

    monkeypatch.setattr("app.api.v1.mcp.run_tool", fake_run_tool)
    response = client.post(f"/api/v1/mcp/queues/{queue['id']}/execute")

    assert response.status_code == 409
    assert response.json()["error_code"] == "MCP_QUEUE_RUNNING"
    assert executed == []


def test_stale_running_queue_can_be_resumed(permission_client):
    client, ids = permission_client
    login(client)
    queue = make_queue(client, [{"id": "EP01", "name": "EP01", "asset_ids": []}])
    with ids["session_factory"]() as session:
        row = session.get(TenantRecord, __import__("uuid").UUID(queue["id"]))
        row.data = {**row.data, "status": "running"}
        session.commit()
        session.execute(
            TenantRecord.__table__.update()
            .where(TenantRecord.id == row.id)
            .values(updated_at=datetime.now(UTC) - timedelta(hours=2))
        )
        session.commit()

    response = client.post(f"/api/v1/mcp/queues/{queue['id']}/execute")

    assert response.status_code == 200
    assert response.json()["status"] == "completed"


def test_queue_claim_is_atomic_when_two_clicks_race(permission_client):
    """Duas execuções com o mesmo estado lido: só a primeira consegue reservar a fila."""
    from app.api.v1.mcp import claim_queue

    client, ids = permission_client
    login(client)
    queue = make_queue(client, [{"id": "EP01", "name": "EP01", "asset_ids": []}])
    uid = __import__("uuid").UUID(queue["id"])
    with ids["session_factory"]() as first, ids["session_factory"]() as second:
        row_a = first.get(TenantRecord, uid)
        row_b = second.get(TenantRecord, uid)
        assert claim_queue(first, row_a) is True
        assert claim_queue(second, row_b) is False


def test_partial_queue_reruns_only_the_failed_targets(permission_client, monkeypatch):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        asset = TenantRecord(
            tenant_id=ids["tenant"], entity_type="Asset", data={"filename": "ok.mp4"}
        )
        session.add(asset)
        session.commit()
        asset_id = str(asset.id)
    login(client)
    queue = make_queue(
        client,
        [
            {"id": "EP01", "name": "EP01", "asset_ids": [asset_id]},
            {"id": "EP02", "name": "EP02", "asset_ids": ["nao-e-uuid"]},
        ],
        mode="immediate",
    )
    assert queue["status"] == "partial"
    executed = []

    async def fake_run_tool(_session, _tenant, _tool, arguments, _user=None):
        executed.append(arguments["project_id"])
        return {"asset_count": 0, "mode": "read_only"}

    monkeypatch.setattr("app.api.v1.mcp.run_tool", fake_run_tool)
    response = client.post(f"/api/v1/mcp/queues/{queue['id']}/execute")

    assert response.status_code == 200
    assert executed == ["EP02"]
    payload = response.json()
    assert payload["status"] == "completed"
    assert [item["target_name"] for item in payload["results"]] == ["EP01", "EP02"]
    assert payload["results"][0]["asset_count"] == 1


def test_completed_queue_is_returned_without_running_again(permission_client, monkeypatch):
    client, _ = permission_client
    login(client)
    queue = make_queue(client, [{"id": "EP01", "name": "EP01", "asset_ids": []}], "immediate")
    assert queue["status"] == "completed"
    executed = []

    async def fake_run_tool(*args, **_kwargs):
        executed.append(args)
        return {}

    monkeypatch.setattr("app.api.v1.mcp.run_tool", fake_run_tool)
    response = client.post(f"/api/v1/mcp/queues/{queue['id']}/execute")

    assert response.status_code == 200
    assert executed == []


def test_queue_failure_after_claim_releases_it_as_failed(permission_client, monkeypatch):
    client, _ = permission_client
    login(client)
    queue = make_queue(client, [{"id": "EP01", "name": "EP01", "asset_ids": []}])

    async def explode(*_args, **_kwargs):
        raise RuntimeError("falha interna")

    monkeypatch.setattr("app.api.v1.mcp.run_tool", explode)
    response = client.post(f"/api/v1/mcp/queues/{queue['id']}/execute")
    assert response.status_code == 500

    queues = client.get("/api/v1/mcp/queues").json()["queues"]
    assert queues[0]["status"] == "failed"


def test_execute_reports_running_when_another_click_claimed_first(permission_client, monkeypatch):
    client, _ = permission_client
    login(client)
    queue = make_queue(client, [{"id": "EP01", "name": "EP01", "asset_ids": []}])
    executed = []

    async def fake_run_tool(*args, **_kwargs):
        executed.append(args)
        return {}

    monkeypatch.setattr("app.api.v1.mcp.claim_queue", lambda _session, _record: False)
    monkeypatch.setattr("app.api.v1.mcp.run_tool", fake_run_tool)
    response = client.post(f"/api/v1/mcp/queues/{queue['id']}/execute")

    assert response.status_code == 409
    assert response.json()["error_code"] == "MCP_QUEUE_RUNNING"
    assert executed == []

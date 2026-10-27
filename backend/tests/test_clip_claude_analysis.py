# ruff: noqa: F811
"""Cortes automáticos com conexão Claude: análise pelo Claude, transcrição local."""

import pytest
from app.clips import analysis as analysis_module
from app.clips import transcription as transcription_module
from app.clips.analysis import (
    ANALYSIS_MAX_TOKENS,
    CommandAnalysisAdapter,
    RemoteAnalysisAdapter,
    _strip_json_fence,
)
from app.clips.contracts import TranscriptSegment, TranscriptWord
from app.clips.transcription import CommandTranscriptionAdapter, TranscriptionUnavailable
from app.models.identity import TenantRecord
from test_clips_api_error_paths import _candidate, _real_source
from test_media_api import login, permission_client  # noqa: F401

CLAUDE = {
    "id": "claude",
    "provider": "anthropic",
    "base_url": "https://api.anthropic.com/v1",
    "model": "claude-sonnet-5-5",
}
CANDIDATES_JSON = (
    '{"candidates":[{"start":0,"end":25,"hook":22,"flow":20,"value":21,"shareability":19}]}'
)


@pytest.fixture
def transcript():
    return [
        TranscriptSegment(
            start=0,
            end=30,
            text="Esta medida melhora a vida.",
            words=[
                TranscriptWord(text="Esta", start=1, end=1.2),
                TranscriptWord(text="medida", start=1.2, end=1.6),
                TranscriptWord(text="melhora", start=1.6, end=2),
                TranscriptWord(text="a", start=2, end=2.1),
                TranscriptWord(text="vida.", start=2.1, end=2.4),
            ],
        )
    ]


def _claude_response(payload, captured):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return payload

    def post(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return Response()

    return post


@pytest.mark.parametrize("text", [CANDIDATES_JSON, f"```json\n{CANDIDATES_JSON}\n```"])
def test_claude_analysis_uses_messages_api_and_maps_evidence(transcript, monkeypatch, text):
    captured = {}
    payload = {
        "content": [{"type": "text", "text": text}],
        "stop_reason": "end_turn",
        "usage": {"input_tokens": 1200, "output_tokens": 80},
    }
    monkeypatch.setattr(analysis_module.httpx, "post", _claude_response(payload, captured))

    adapter = RemoteAnalysisAdapter(CLAUDE, "sk-ant-teste")
    candidates = adapter.suggest(transcript, editorial_prompt="humor")

    assert captured["url"] == "https://api.anthropic.com/v1/messages"
    assert captured["headers"]["x-api-key"] == "sk-ant-teste"
    assert captured["headers"]["anthropic-version"] == "2023-06-01"
    assert "Authorization" not in captured["headers"]
    assert captured["json"]["model"] == "claude-sonnet-5-5"
    assert captured["json"]["max_tokens"] == ANALYSIS_MAX_TOKENS
    assert "response_format" not in captured["json"]
    assert captured["json"]["system"]
    assert candidates[0].quote == "Esta medida melhora a vida."
    assert candidates[0].score == 82
    assert adapter.usage == {"input_tokens": 1200, "output_tokens": 80}


def test_claude_truncated_answer_fails_without_partial_cuts(transcript, monkeypatch):
    payload = {
        "content": [{"type": "text", "text": '{"candidates":[{"start":0'}],
        "stop_reason": "max_tokens",
    }
    monkeypatch.setattr(analysis_module.httpx, "post", _claude_response(payload, {}))

    with pytest.raises(TranscriptionUnavailable, match="não conseguiu propor"):
        RemoteAnalysisAdapter(CLAUDE, "sk-ant-teste").suggest(transcript)


def test_claude_error_does_not_leak_the_key(transcript, monkeypatch):
    payload = {"type": "error", "error": {"message": "sk-ant-teste inválida"}}
    monkeypatch.setattr(analysis_module.httpx, "post", _claude_response(payload, {}))

    with pytest.raises(TranscriptionUnavailable) as error:
        RemoteAnalysisAdapter(CLAUDE, "sk-ant-teste").suggest(transcript)
    assert "sk-ant-teste" not in str(error.value)


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        ('{"a":1}', '{"a":1}'),
        ('```json\n{"a":1}\n```', '{"a":1}'),
        ('```\n{"a":1}```', '{"a":1}'),
        ("```", ""),
    ],
)
def test_strip_json_fence(content, expected):
    assert _strip_json_fence(content) == expected


def test_local_commands_are_read_from_settings_when_env_is_unset(monkeypatch):
    class Settings:
        clips_transcriber_command = "transcrever {input} {output}"
        clips_analysis_command = "analisar {input} {output}"

    monkeypatch.delenv("CLIPS_TRANSCRIBER_COMMAND", raising=False)
    monkeypatch.delenv("CLIPS_ANALYSIS_COMMAND", raising=False)
    monkeypatch.setattr(transcription_module, "get_settings", lambda: Settings)
    monkeypatch.setattr(analysis_module, "get_settings", lambda: Settings)

    assert CommandTranscriptionAdapter.from_environment().command_template == (
        "transcrever {input} {output}"
    )
    assert CommandAnalysisAdapter.from_environment().command_template == (
        "analisar {input} {output}"
    )


def test_local_transcriber_runs_from_project_root(tmp_path, monkeypatch):
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    seen = {}

    def fake_run(command, **kwargs):
        seen["cwd"] = kwargs.get("cwd")
        raise OSError("sem transcritor")

    monkeypatch.setattr(transcription_module.subprocess, "run", fake_run)
    with pytest.raises(TranscriptionUnavailable):
        CommandTranscriptionAdapter("transcrever {input} {output}").transcribe(source)
    assert seen["cwd"] == transcription_module.ROOT


def _save_claude_connection(ids):
    with ids["session_factory"]() as session:
        session.add(
            TenantRecord(
                tenant_id=ids["tenant"],
                entity_type="AISettings",
                data={
                    "connections": [
                        {**CLAUDE, "enabled": True, "encrypted_key": "cifrada"},
                    ]
                },
            )
        )
        session.commit()


def test_claude_connection_transcribes_locally_and_analyzes_with_claude(
    permission_client, monkeypatch, tmp_path
):
    client, ids = permission_client
    login(client)
    asset_id = _real_source(ids, tmp_path, monkeypatch)
    _save_claude_connection(ids)
    segment, candidate = _candidate()
    received = {}

    class LocalTranscriber:
        def transcribe(self, _path):
            received["local_transcription"] = True
            return [segment]

    class NoRemoteTranscription:
        def __init__(self, *_args):
            raise AssertionError("Claude não transcreve áudio")

    class FakeAnalysis:
        def __init__(self, connection, api_key):
            received["analysis"] = (connection["id"], api_key)
            self.usage = {"input_tokens": 10, "output_tokens": 5}

        def suggest(self, _segments, **_kwargs):
            return [candidate]

    monkeypatch.setattr("app.api.v1.clips.decrypt_ai_key", lambda _connection: "chave-real")
    monkeypatch.setattr(
        "app.api.v1.clips.CommandTranscriptionAdapter.from_environment",
        lambda: LocalTranscriber(),
    )
    monkeypatch.setattr("app.api.v1.clips.RemoteTranscriptionAdapter", NoRemoteTranscription)
    monkeypatch.setattr("app.api.v1.clips.RemoteAnalysisAdapter", FakeAnalysis)

    response = client.post(
        "/api/v1/clips/analyses", json={"asset_id": str(asset_id), "connection_id": "claude"}
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["status"] == "completed"
    assert len(payload["candidates"]) == 1
    assert received == {"local_transcription": True, "analysis": ("claude", "chave-real")}
    assert "chave-real" not in response.text


def test_claude_connection_without_local_transcriber_is_honestly_unavailable(
    permission_client, monkeypatch, tmp_path
):
    client, ids = permission_client
    login(client)
    asset_id = _real_source(ids, tmp_path, monkeypatch)
    _save_claude_connection(ids)
    monkeypatch.setattr("app.api.v1.clips.decrypt_ai_key", lambda _connection: "chave-real")
    monkeypatch.setattr(
        "app.api.v1.clips.CommandTranscriptionAdapter.from_environment",
        lambda: CommandTranscriptionAdapter(None),
    )

    response = client.post(
        "/api/v1/clips/analyses", json={"asset_id": str(asset_id), "connection_id": "claude"}
    )

    assert response.status_code == 202
    assert response.json()["status"] == "unavailable"
    assert response.json()["candidates"] == []

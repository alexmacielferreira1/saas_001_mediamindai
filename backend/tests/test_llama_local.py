"""Llama local (Ollama) como IA da empresa, sem abrir a rede interna.

O administrador do servidor libera endereços exatos em OUTBOUND_ALLOWED_HOSTS (host:porta);
qualquer outro destino interno continua bloqueado. Nos cortes, a transcrição de uma conexão
local é feita pelo Whisper do servidor (o Ollama não transcreve áudio).
"""

# ruff: noqa: F811

import pytest
from app.core.config import get_settings
from app.models.identity import TenantRecord
from app.security.outbound import (
    OutboundUrlRejected,
    allowed_hosts,
    is_local_destination,
    validate_outbound_url,
)
from cryptography.fernet import Fernet
from test_clips_api_error_paths import _candidate, _real_source
from test_media_api import login, permission_client  # noqa: F401

OLLAMA = {
    "id": "llama",
    "provider": "compatible",
    "base_url": "http://127.0.0.1:11434/v1",
    "model": "llama3.1:8b",
}


@pytest.fixture
def allowed(monkeypatch):
    monkeypatch.setenv("OUTBOUND_ALLOW_PRIVATE_NETWORKS", "false")
    monkeypatch.setenv(
        "OUTBOUND_ALLOWED_HOSTS", "127.0.0.1:11434, Ollama.Emissora.:11434, sem-porta, :80"
    )
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_only_the_listed_host_and_port_are_opened(allowed):
    assert allowed_hosts() == {("127.0.0.1", 11434), ("ollama.emissora", 11434)}
    assert validate_outbound_url("http://127.0.0.1:11434/v1/chat/completions")
    assert validate_outbound_url("http://ollama.emissora:11434/v1")
    for blocked in (
        "http://127.0.0.1:5432/",
        "http://127.0.0.1/v1",
        "http://10.0.0.5:11434/v1",
        "http://169.254.169.254/latest",
        "http://localhost:11434/v1",
    ):
        with pytest.raises(OutboundUrlRejected):
            validate_outbound_url(blocked)


def test_nothing_is_opened_by_default(monkeypatch):
    monkeypatch.delenv("OUTBOUND_ALLOWED_HOSTS", raising=False)
    monkeypatch.setenv("OUTBOUND_ALLOW_PRIVATE_NETWORKS", "false")
    monkeypatch.setattr(
        "app.core.config.Settings.model_config", {**get_settings().model_config, "env_file": None}
    )
    get_settings.cache_clear()
    assert allowed_hosts() == set()
    with pytest.raises(OutboundUrlRejected):
        validate_outbound_url("http://127.0.0.1:11434/v1")
    get_settings.cache_clear()


def test_local_destination_detection(allowed):
    assert is_local_destination("http://127.0.0.1:11434/v1")
    assert is_local_destination("http://192.168.0.20:11434/v1")
    assert is_local_destination("http://localhost:11434/v1")
    assert is_local_destination("http://ollama.emissora:11434/v1")
    assert not is_local_destination("https://api.openai.com/v1")
    assert not is_local_destination("https://8.8.8.8/v1")
    assert not is_local_destination("http:///sem-host")
    assert not is_local_destination("http://127.0.0.1:porta/v1")


def test_company_can_save_the_allowed_llama_connection(permission_client, allowed, monkeypatch):
    client, _ids = permission_client
    monkeypatch.setenv("AI_SECRET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    login(client)

    saved = client.put(
        "/api/v1/ai/connections",
        json={
            "connections": [{**OLLAMA, "name": "Llama local", "api_key": "ollama"}],
            "default_connection_id": "llama",
        },
    )
    assert saved.status_code == 200
    other_port = client.put(
        "/api/v1/ai/connections",
        json={
            "connections": [
                {**OLLAMA, "name": "Banco", "base_url": "http://127.0.0.1:5433/v1", "api_key": "x"}
            ],
            "default_connection_id": "llama",
        },
    )
    assert other_port.status_code == 422
    assert other_port.json()["error_code"] == "AI_DESTINATION_BLOCKED"


def test_llama_connection_transcribes_with_local_whisper_and_analyzes_with_llama(
    permission_client, allowed, monkeypatch, tmp_path
):
    client, ids = permission_client
    login(client)
    asset_id = _real_source(ids, tmp_path, monkeypatch)
    with ids["session_factory"]() as session:
        session.add(
            TenantRecord(
                tenant_id=ids["tenant"],
                entity_type="AISettings",
                data={"connections": [{**OLLAMA, "enabled": True, "encrypted_key": "cifrada"}]},
            )
        )
        session.commit()
    segment, candidate = _candidate()
    received = {}

    class LocalWhisper:
        def transcribe(self, _path):
            received["whisper"] = True
            return [segment]

    class NoRemoteTranscription:
        def __init__(self, *_args):
            raise AssertionError("o Ollama não tem /audio/transcriptions")

    class LlamaAnalysis:
        def __init__(self, connection, api_key):
            received["analysis"] = (connection["model"], api_key)
            self.usage = {"prompt_tokens": 10, "completion_tokens": 5}

        def suggest(self, _segments, **_kwargs):
            return [candidate]

    monkeypatch.setattr("app.api.v1.clips.decrypt_ai_key", lambda _connection: "ollama")
    monkeypatch.setattr(
        "app.api.v1.clips.CommandTranscriptionAdapter.from_environment", lambda: LocalWhisper()
    )
    monkeypatch.setattr("app.api.v1.clips.RemoteTranscriptionAdapter", NoRemoteTranscription)
    monkeypatch.setattr("app.api.v1.clips.RemoteAnalysisAdapter", LlamaAnalysis)

    response = client.post(
        "/api/v1/clips/analyses", json={"asset_id": str(asset_id), "connection_id": "llama"}
    )

    assert response.status_code == 202
    assert response.json()["status"] == "completed"
    assert len(response.json()["candidates"]) == 1
    assert received == {"whisper": True, "analysis": ("llama3.1:8b", "ollama")}


def _llama_reply(monkeypatch, candidates):
    import json

    class Reply:
        def raise_for_status(self):
            return None

        def json(self):
            content = json.dumps({"candidates": candidates})
            return {"choices": [{"message": {"content": content}}], "usage": {}}

    monkeypatch.setattr("app.clips.analysis.httpx.post", lambda *_args, **_kwargs: Reply())


def _speech(seconds=40):
    from app.clips.contracts import TranscriptSegment, TranscriptWord

    # Frases de 5 s (0-5, 5-10, ...), com uma palavra por segundo.
    return [
        TranscriptSegment(
            start=first,
            end=first + 5,
            text="fala",
            words=[
                TranscriptWord(text=f"p{i}", start=i, end=i + 0.8) for i in range(first, first + 5)
            ],
        )
        for first in range(0, seconds, 5)
    ]


def test_llama_proposals_are_fitted_or_dropped_one_by_one(allowed, monkeypatch):
    from app.clips.analysis import RemoteAnalysisAdapter

    scores = {"hook": 20, "flow": 20, "value": 20, "shareability": 20}
    _llama_reply(
        monkeypatch,
        [
            {"start": 0, "end": 8, **scores},  # só a frase de abertura: estende até 15 s
            {"start": 5, "end": 30, **scores},
            {"start": 31, "end": 33, **scores},  # a mídia acaba antes de 15 s: recusada
            {"start": "x", "end": 30, **scores},  # tempo inválido: recusada
        ],
    )
    adapter = RemoteAnalysisAdapter(OLLAMA, "ollama")

    result = adapter.suggest(_speech(), minimum=15, maximum=40)

    assert [(item.start, item.end) for item in result] == [(0.0, 15.0), (5.0, 30.0)]


def test_fitting_never_passes_the_maximum():
    from app.clips.analysis import fit_to_minimum

    proposal = {"start": 0, "end": 4}
    assert fit_to_minimum(proposal, _speech(), minimum=15, maximum=12) == proposal
    assert fit_to_minimum({"start": 0, "end": 20}, _speech(), 15, 40) == {"start": 0, "end": 20}


def test_all_invalid_llama_proposals_fail_honestly(allowed, monkeypatch):
    from app.clips.analysis import RemoteAnalysisAdapter
    from app.clips.transcription import TranscriptionUnavailable

    _llama_reply(monkeypatch, [{"start": 0, "end": 3}])
    with pytest.raises(TranscriptionUnavailable, match="sem evidências"):
        RemoteAnalysisAdapter(OLLAMA, "ollama").suggest(_speech(), minimum=15, maximum=40)
    _llama_reply(monkeypatch, [])
    assert RemoteAnalysisAdapter(OLLAMA, "ollama").suggest(_speech()) == []


def test_analysis_failure_shows_the_real_reason(permission_client, allowed, monkeypatch, tmp_path):
    from app.clips.transcription import TranscriptionUnavailable

    client, ids = permission_client
    login(client)
    asset_id = _real_source(ids, tmp_path, monkeypatch)

    class BrokenWhisper:
        def transcribe(self, _path):
            raise TranscriptionUnavailable("O transcritor retornou marcações de tempo inválidas.")

    monkeypatch.setattr(
        "app.api.v1.clips.CommandTranscriptionAdapter.from_environment", lambda: BrokenWhisper()
    )
    response = client.post("/api/v1/clips/analyses", json={"asset_id": str(asset_id)})

    assert response.json()["status"] == "unavailable"
    assert response.json()["message"] == ("O transcritor retornou marcações de tempo inválidas.")

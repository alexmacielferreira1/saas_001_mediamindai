# ruff: noqa: F811

import pytest
from app.clips.contracts import TranscriptSegment, TranscriptWord
from app.clips.transcription import TranscriptionUnavailable
from app.core.errors import PublicError
from app.models.identity import TenantRecord
from sqlalchemy import select
from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401

LLAMA = {
    "id": "llama",
    "name": "Llama local",
    "provider": "compatible",
    "base_url": "http://127.0.0.1:11434/v1",
    "model": "llama3.1:8b",
    "enabled": True,
    "encrypted_key": "cifrada",
}


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


@pytest.fixture
def llama(monkeypatch, media_root):
    """Conexão Llama configurada e uma resposta do modelo controlada pelo teste."""
    state = {"reply": "{}", "replies": [], "prompts": [], "error": None}

    async def generate(connection, prompt, *, max_tokens, return_usage):
        state["prompts"].append((connection["model"], prompt))
        if state["error"]:
            raise state["error"]
        reply = state["replies"].pop(0) if state["replies"] else state["reply"]
        return reply, {"prompt_tokens": 12, "completion_tokens": 8}

    monkeypatch.setattr("app.api.v1.ai_tools.generate_connection_text", generate)
    return state


def configure(ids, tool_connections=None):
    with ids["session_factory"]() as session:
        session.add(
            TenantRecord(
                tenant_id=ids["tenant"],
                entity_type="AISettings",
                data={
                    "connections": [LLAMA],
                    "default_connection_id": "llama",
                    "tool_connections": tool_connections or {},
                },
            )
        )
        session.commit()


def usage_events(ids):
    with ids["session_factory"]() as session:
        rows = session.scalars(
            select(TenantRecord).where(TenantRecord.entity_type == "AIUsageEvent")
        ).all()
        return [(row.data["feature"], row.data["status"]) for row in rows]


def test_tools_explain_when_no_ai_is_configured(permission_client, llama):
    client, _ids = permission_client
    login(client)
    response = client.post("/api/v1/ai/tools/script", json={"prompt": "Abertura"})
    assert response.status_code == 503
    assert response.json()["message"] == "Configure uma IA para Roteiro em Configuração de IA."
    assert llama["prompts"] == []


def test_script_returns_validated_blocks_and_records_usage(permission_client, llama):
    client, ids = permission_client
    login(client)
    configure(ids, {"script-writing": "llama"})
    llama["reply"] = (
        "Claro! Segue:\n```json\n"
        '{"blocos":[{"track":"t2","content":"Abertura com a praça"},'
        '{"track":"t9","content":"Off sobre a obra"},{"content":"  "},"lixo"],'
        '"ajustes":[{"tipo":"corte","timecode":"00:00:05","descricao":"Cortar no aplauso"},'
        '{"descricao":""}]}\n```'
    )

    response = client.post(
        "/api/v1/ai/tools/script",
        json={"prompt": "Abertura de 30 s", "context": {"titulo": "Praça"}},
    )

    assert response.status_code == 200
    assert response.json() == {
        "blocos": [
            {"track": "t2", "content": "Abertura com a praça"},
            {"track": "t1", "content": "Off sobre a obra"},
        ],
        "ajustes": [{"tipo": "corte", "timecode": "00:00:05", "descricao": "Cortar no aplauso"}],
        "transcription": "",
    }
    model, prompt = llama["prompts"][0]
    assert model == "llama3.1:8b"
    assert "Abertura de 30 s" in prompt and '"titulo": "Praça"' in prompt
    assert ("ai-tools.script", "ok") in usage_events(ids)


def test_script_rejects_answers_outside_the_format(permission_client, llama):
    client, ids = permission_client
    login(client)
    configure(ids)
    for reply in ("Não sei fazer isso.", '["lista"]', '{"blocos":[],"ajustes":[]}'):
        llama["reply"] = reply
        response = client.post("/api/v1/ai/tools/script", json={"prompt": "Roteiro"})
        assert response.status_code == 502
        assert response.json()["error_code"] == "AI_INVALID_RESPONSE"
    assert client.post("/api/v1/ai/tools/script", json={}).status_code == 422


def test_local_model_gets_a_second_chance_and_text_around_json_is_ignored(permission_client, llama):
    client, ids = permission_client
    login(client)
    configure(ids)
    llama["replies"] = [
        "Desculpe, não entendi.",
        'Aqui vai {rascunho} e o JSON: {"blocos":[{"content":"Boa noite"}]} Espero que {ajude}',
    ]

    response = client.post("/api/v1/ai/tools/script", json={"prompt": "Abertura"})

    assert response.status_code == 200
    assert response.json()["blocos"] == [{"track": "t1", "content": "Boa noite"}]
    assert len(llama["prompts"]) == 2


def test_provider_error_is_recorded_and_returned(permission_client, llama):
    client, ids = permission_client
    login(client)
    configure(ids)
    llama["error"] = PublicError(503, "AI_PROVIDER_UNAVAILABLE", "O provedor está fora.")

    response = client.post("/api/v1/ai/tools/script", json={"prompt": "Roteiro"})

    assert response.status_code == 503
    assert ("ai-tools.script", "error") in usage_events(ids)


def test_audio_prompt_is_transcribed_by_local_whisper(permission_client, llama, monkeypatch):
    client, ids = permission_client
    login(client)
    configure(ids)
    uploaded = client.post(
        "/api/v1/uploads", files={"file": ("audio.webm", b"audio-gravado", "audio/webm")}
    ).json()

    class Whisper:
        def transcribe(self, source):
            assert source.read_bytes() == b"audio-gravado"
            word = TranscriptWord(text="Abertura", start=0, end=1)
            return [TranscriptSegment(start=0, end=1, text="Abertura sobre a praça.", words=[word])]

    monkeypatch.setattr(
        "app.api.v1.ai_tools.CommandTranscriptionAdapter.from_environment", lambda: Whisper()
    )
    llama["reply"] = '{"blocos":[{"content":"Boa noite"}],"ajustes":[]}'

    response = client.post("/api/v1/ai/tools/script", json={"audio_url": uploaded["file_url"]})

    assert response.json()["transcription"] == "Abertura sobre a praça."
    assert "Abertura sobre a praça." in llama["prompts"][0][1]

    class Broken:
        def transcribe(self, _source):
            raise TranscriptionUnavailable("Nenhuma fala reconhecida.")

    monkeypatch.setattr(
        "app.api.v1.ai_tools.CommandTranscriptionAdapter.from_environment", lambda: Broken()
    )
    failed = client.post("/api/v1/ai/tools/script", json={"audio_url": uploaded["file_url"]})
    assert failed.status_code == 503
    assert failed.json()["message"] == "Nenhuma fala reconhecida."
    for url in ("/api/v1/uploads/nao-existe.webm", "https://outro.site/a.webm"):
        missing = client.post("/api/v1/ai/tools/script", json={"audio_url": url})
        assert missing.status_code == 404


def test_assistant_only_routes_to_pages_the_screen_offered(permission_client, llama):
    client, ids = permission_client
    login(client)
    configure(ids, {"assistant": "llama"})
    llama["reply"] = (
        '{"reply":"Vá para o Ingest.","rotas":[{"path":"/ingest","motivo":"enviar arquivos"},'
        '{"path":"/ingest"},{"path":"/admin/segredo"},"x"],"confirmacao":"Quer abrir agora?"}'
    )
    body = {
        "message": "Como envio um vídeo?",
        "history": [{"role": "user", "content": "oi"}],
        "role_label": "Editor",
        "user_name": "Ana",
        "destinations": [{"path": "/ingest", "label": "Ingest", "desc": "Importar mídia"}],
    }

    response = client.post("/api/v1/ai/tools/assistant", json=body)

    assert response.json() == {
        "reply": "Vá para o Ingest.",
        "rotas": [{"path": "/ingest", "label": "Ingest", "motivo": "enviar arquivos"}],
        "confirmacao": "Quer abrir agora?",
        "transcription": "",
    }
    prompt = llama["prompts"][0][1]
    assert "/ingest: Ingest" in prompt and "user: oi" in prompt and "Ana (Editor)" in prompt

    llama["reply"] = "Use a página de Ingest para enviar."
    plain = client.post("/api/v1/ai/tools/assistant", json={"message": "oi"}).json()
    assert plain == {
        "reply": "Use a página de Ingest para enviar.",
        "rotas": [],
        "confirmacao": None,
        "transcription": "",
    }
    llama["reply"] = '{"rotas":[]}'
    empty_reply = client.post("/api/v1/ai/tools/assistant", json={"message": "oi"}).json()
    assert empty_reply["reply"] == '{"rotas":[]}'


def test_tasks_suggestions_are_limited_to_listed_tasks_and_statuses(permission_client, llama):
    client, ids = permission_client
    login(client)
    configure(ids, {"automation": "llama"})
    llama["reply"] = (
        '{"sugestoes":['
        '{"pendencia_id":1,"acao":"Concluir revisão","novo_status":"concluido",'
        '"justificativa":"ok"},'
        '{"pendencia_id":"99","acao":"Inventada","novo_status":"concluido"},'
        '{"pendencia_id":"2","acao":"Apagar tudo","novo_status":"arquivado"},'
        '{"pendencia_id":"2","acao":"","novo_status":"pendente"},"x"]}'
    )
    body = {
        "segment": "edicao",
        "prompt": "finalize as revisões",
        "pendencias": [
            {"id": 1, "titulo": "Revisar VT", "status": "em_andamento"},
            {"id": "2", "titulo": "Enviar arte", "status": "pendente", "detalhe": "logo"},
            {"titulo": "sem id"},
        ],
    }

    response = client.post("/api/v1/ai/tools/tasks", json=body)

    assert response.json()["sugestoes"] == [
        {
            "pendencia_id": "1",
            "acao": "Concluir revisão",
            "novo_status": "concluido",
            "justificativa": "ok",
        }
    ]
    assert '"descricao": "logo"' in llama["prompts"][0][1]
    no_tasks = client.post("/api/v1/ai/tools/tasks", json={"prompt": "x", "pendencias": []})
    assert no_tasks.status_code == 422
    llama["reply"] = "sem json"
    assert client.post("/api/v1/ai/tools/tasks", json=body).status_code == 502


def test_access_needs_user_management_and_uses_only_known_ids(permission_client, llama):
    client, ids = permission_client
    configure(ids, {"automation": "llama"})
    body = {
        "user_name": "Marina",
        "prompt": "videomaker, vê Produção e Gravações, sem Design",
        "screens": [{"id": "producao", "name": "Produção"}, {"id": "design", "name": "Design"}],
        "cargos": [{"id": "videomaker", "name": "Videomaker"}],
    }
    login(client, "viewer@mediamind.ai")
    assert client.post("/api/v1/ai/tools/access", json=body).status_code == 403

    login(client)
    llama["reply"] = (
        '{"role":"videomaker","extraTabs":["producao","producao","inventada"],'
        '"removedTabs":["design"]}'
    )
    response = client.post("/api/v1/ai/tools/access", json=body)
    assert response.json() == {
        "role": "videomaker",
        "extraTabs": ["producao"],
        "removedTabs": ["design"],
        "transcription": "",
    }
    # O modelo escreveu os nomes em vez dos ids: vale, desde que existam nas listas.
    llama["reply"] = '{"role":"Videomaker","extraTabs":["Produção"],"removedTabs":[7]}'
    assert client.post("/api/v1/ai/tools/access", json=body).json() == {
        "role": "videomaker",
        "extraTabs": ["producao"],
        "removedTabs": [],
        "transcription": "",
    }
    llama["reply"] = '{"role":"diretor","extraTabs":"producao"}'
    assert client.post("/api/v1/ai/tools/access", json=body).json() == {
        "role": "",
        "extraTabs": [],
        "removedTabs": [],
        "transcription": "",
    }
    llama["reply"] = "nada"
    assert client.post("/api/v1/ai/tools/access", json=body).status_code == 502


def test_tools_require_login(permission_client, llama):
    client, _ids = permission_client
    for path in ("script", "assistant", "tasks", "access"):
        assert client.post(f"/api/v1/ai/tools/{path}", json={}).status_code == 401

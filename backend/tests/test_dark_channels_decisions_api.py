"""Canais Dark: decisões da estrutura, edição da estrutura (PUT) e respostas na tela."""

from test_dark_channels_structure_api import (
    IMPORT_URL,
    _import_fixture,
    _login_other_tenant_writer,
    _tenant_records,
    login,
)

pytest_plugins = ["test_permission_groups_api"]

STRUCTURE_URL = "/api/v1/dark-channels/structure"
DECISION_URL = "/api/v1/dark-channels/structure/decisions"
PADRAO_DECISIONS = [
    "marca-guarda-chuva",
    "plataformas-iniciais",
    "fornecedor-voz",
    "fornecedor-visual",
    "armazenamento-midia",
    "cadencia-inicial",
    "revisao-humana",
    "declaracao-ia",
]


def _decision(decision_id, **extra):
    return {
        "id": decision_id,
        "title": f"Decisão {decision_id}",
        "question": "Qual caminho seguir?",
        "options": ["A", "B"],
        **extra,
    }


def _structure_body(**overrides):
    body = {
        "name": "Minha estrutura",
        "languages": [
            {"code": "pt-BR", "name": "Português", "launch_wave": 1},
            {"code": "en-US", "name": "Inglês", "enabled": False},
        ],
        "niches": [{"code": "HIS", "name": "Histórias", "subniches": ["antiga"]}],
        "decisions": [_decision("voz"), _decision("cadencia", scope="nicho", ref="HIS")],
    }
    return {**body, **overrides}


def _audit_actions(ids, tenant_key="tenant"):
    return [item.data["action"] for item in _tenant_records(ids, tenant_key, "LogAuditoria")]


# --- Modelos e estrutura padrão ---


def test_templates_ship_generic_decisions(permission_client):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")

    padrao = client.get("/api/v1/dark-channels/structure/templates/padrao").json()
    religioso = client.get("/api/v1/dark-channels/structure/templates/religioso-multilingue").json()
    listed = {
        item["id"]: item
        for item in client.get("/api/v1/dark-channels/structure/templates").json()["templates"]
    }

    assert [item["id"] for item in padrao["decisions"]] == PADRAO_DECISIONS
    assert all(item["status"] == "pendente" for item in padrao["decisions"])
    assert all(item["decided_at"] is None and item["answer"] == "" for item in padrao["decisions"])
    marca = padrao["decisions"][0]
    assert marca["options"] == [
        "Não mostrar marca comum",
        "Marca comum discreta",
        "Marca comum forte",
    ]
    assert marca["recommendation"].startswith("Não mostrar")
    assert padrao["decisions"][-1]["options"] == ["Sempre declarar quando aplicável"]
    religioso_ids = [item["id"] for item in religioso["decisions"]]
    assert religioso_ids == [
        *PADRAO_DECISIONS,
        "fonte-biblica-por-idioma",
        "enquadramento-regional",
    ]
    assert listed["padrao"]["decisions_count"] == 8
    assert listed["religioso-multilingue"]["decisions_count"] == 10
    assert all(
        language["enabled"] is True and language["launch_wave"] is None
        for language in padrao["languages"]
    )


def test_default_structure_includes_decisions(permission_client):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")

    structure = client.get(STRUCTURE_URL).json()

    assert structure["is_default"] is True
    assert [item["id"] for item in structure["decisions"]] == PADRAO_DECISIONS


def test_legacy_saved_structure_gets_new_defaults(permission_client):
    client, ids = permission_client
    login(client)
    from app.models.identity import TenantRecord

    with ids["session_factory"]() as session:
        session.add(
            TenantRecord(
                tenant_id=ids["tenant"],
                entity_type="EstruturaCanaisDark",
                data={
                    "schema": "mediamind.dark-structure/v1",
                    "name": "Antiga",
                    "languages": [{"code": "pt-BR", "name": "Português"}],
                    "niches": [],
                    "source": "importado",
                    "template_id": None,
                    "updated_at": "2026-10-01T00:00:00+00:00",
                },
            )
        )
        session.commit()

    structure = client.get(STRUCTURE_URL).json()

    assert structure["decisions"] == []
    assert structure["languages"][0]["enabled"] is True
    assert structure["languages"][0]["launch_wave"] is None
    assert structure["languages"][0]["regional_frame"] == ""


# --- PUT /structure ---


def test_put_structure_materializes_default_as_personalizado(permission_client):
    client, ids = permission_client
    login(client)

    response = client.put(STRUCTURE_URL, json=_structure_body())

    assert response.status_code == 200
    body = response.json()
    assert body["is_default"] is False
    assert body["source"] == "personalizado"
    assert body["template_id"] == "padrao"
    assert body["name"] == "Minha estrutura"
    assert body["languages"][0] == {
        "code": "pt-BR",
        "name": "Português",
        "regional_frame": "",
        "notes": "",
        "launch_wave": 1,
        "enabled": True,
    }
    assert body["languages"][1]["enabled"] is False
    assert body["decisions"][1]["scope"] == "nicho"
    assert body["decisions"][1]["ref"] == "HIS"
    assert body["decisions"][0]["status"] == "pendente"
    assert body["decisions"][0]["decided_at"] is None
    assert client.get(STRUCTURE_URL).json() == body
    assert len(_tenant_records(ids, "tenant", "EstruturaCanaisDark")) == 1
    assert _audit_actions(ids) == ["dark_structure.updated"]

    without_name = client.put(STRUCTURE_URL, json={**_structure_body(), "name": None})
    assert without_name.json()["name"] == "Minha estrutura"


def test_put_structure_keeps_source_and_decided_at_of_unchanged_decisions(permission_client):
    client, _ = permission_client
    login(client)
    client.post(IMPORT_URL, json={"package": _import_fixture(), "dry_run": False})
    body = _structure_body(
        decisions=[
            _decision(
                "voz",
                status="decidida",
                answer="ElevenLabs",
                decided_at="1999-01-01T00:00:00+00:00",
            ),
            _decision("cadencia", status="decidida", answer="3/semana"),
        ]
    )

    first = client.put(STRUCTURE_URL, json=body).json()
    assert first["source"] == "importado"
    voz_at = first["decisions"][0]["decided_at"]
    assert voz_at and not voz_at.startswith("1999")

    body["decisions"][1]["answer"] = "5/semana"
    body["decisions"].append(_decision("nova"))
    second = client.put(STRUCTURE_URL, json=body).json()

    assert second["decisions"][0]["decided_at"] == voz_at
    assert second["decisions"][1]["answer"] == "5/semana"
    assert second["decisions"][1]["decided_at"] >= first["decisions"][1]["decided_at"]
    body["decisions"][0]["status"] = "pendente"
    reopened = client.put(STRUCTURE_URL, json=body).json()
    assert reopened["decisions"][0]["decided_at"] is None
    assert reopened["decisions"][0]["answer"] == "ElevenLabs"


def test_put_structure_validation(permission_client):
    client, _ = permission_client
    login(client)
    invalid_bodies = [
        _structure_body(decisions=[_decision("x"), _decision("x")]),
        _structure_body(decisions=[_decision("Com Espaço")]),
        _structure_body(decisions=[_decision("a" * 61)]),
        _structure_body(decisions=[_decision("x", options=["   "])]),
        _structure_body(decisions=[_decision("x", options=[f"o{i}" for i in range(13)])]),
        _structure_body(decisions=[_decision("x", scope="planeta")]),
        _structure_body(decisions=[_decision("x", status="talvez")]),
        _structure_body(decisions=[_decision("x", status="decidida", answer="  ")]),
        _structure_body(decisions=[_decision("x", title="  ")]),
        _structure_body(decisions=[_decision(f"d{i}") for i in range(101)]),
        _structure_body(languages=[{"code": "pt", "name": "A"}, {"code": "pt", "name": "B"}]),
        _structure_body(languages=[{"code": "pt", "name": "A", "launch_wave": 0}]),
        _structure_body(niches=[{"code": "A", "name": "A"}, {"code": "A", "name": "B"}]),
        {"languages": [], "niches": []},
        {**_structure_body(), "extra": True},
    ]
    for body in invalid_bodies:
        assert client.put(STRUCTURE_URL, json=body).status_code == 422, body
    assert client.get(STRUCTURE_URL).json()["is_default"] is True


def test_put_structure_requires_auth_and_production_permission(permission_client):
    client, ids = permission_client
    assert client.put(STRUCTURE_URL, json=_structure_body()).status_code == 401
    login(client, "viewer@mediamind.ai")

    response = client.put(STRUCTURE_URL, json=_structure_body())

    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"
    assert _tenant_records(ids, "tenant", "EstruturaCanaisDark") == []


def test_put_structure_is_tenant_scoped(permission_client):
    client, ids = permission_client
    login(client)
    client.put(STRUCTURE_URL, json=_structure_body())

    _login_other_tenant_writer(client, ids)
    assert client.get(STRUCTURE_URL).json()["is_default"] is True
    response = client.put(STRUCTURE_URL, json=_structure_body(name="Estrutura B"))

    assert response.json()["name"] == "Estrutura B"
    tenant_a = _tenant_records(ids, "tenant", "EstruturaCanaisDark")
    assert [item.data["name"] for item in tenant_a] == ["Minha estrutura"]
    assert len(_tenant_records(ids, "other", "EstruturaCanaisDark")) == 1


# --- PATCH /structure/decisions/{id} ---


def test_decide_requires_answer_and_reopen_clears_decided_at(permission_client):
    client, ids = permission_client
    login(client)
    url = f"{DECISION_URL}/fornecedor-voz"

    missing_answer = client.patch(url, json={"status": "decidida"})
    assert missing_answer.status_code == 422
    assert missing_answer.json()["error_code"] == "DARK_DECISION_ANSWER_REQUIRED"
    assert _tenant_records(ids, "tenant", "EstruturaCanaisDark") == []

    decided = client.patch(url, json={"status": "decidida", "answer": " ElevenLabs "})
    assert decided.status_code == 200
    decision = decided.json()
    assert decision["id"] == "fornecedor-voz"
    assert decision["status"] == "decidida"
    assert decision["answer"] == "ElevenLabs"
    assert decision["decided_at"]

    structure = client.get(STRUCTURE_URL).json()
    assert structure["is_default"] is False
    assert structure["source"] == "padrao"
    assert len(structure["decisions"]) == 8

    noted = client.patch(url, json={"notes": "Conta já criada"}).json()
    assert noted["decided_at"] == decision["decided_at"]
    assert noted["notes"] == "Conta já criada"
    blank_answer = client.patch(url, json={"answer": "  "})
    assert blank_answer.json()["error_code"] == "DARK_DECISION_ANSWER_REQUIRED"

    reopened = client.patch(url, json={"status": "pendente"}).json()
    assert reopened["status"] == "pendente"
    assert reopened["decided_at"] is None
    assert reopened["answer"] == "ElevenLabs"

    pending_edit = client.patch(url, json={"answer": "Fish Audio"}).json()
    assert pending_edit["status"] == "pendente"
    assert pending_edit["decided_at"] is None
    assert _audit_actions(ids).count("dark_structure.decision_updated") == 4


def test_decision_patch_validation_and_not_found(permission_client):
    client, _ = permission_client
    login(client)

    empty = client.patch(f"{DECISION_URL}/fornecedor-voz", json={})
    nulls = client.patch(f"{DECISION_URL}/fornecedor-voz", json={"status": None})
    invalid = client.patch(f"{DECISION_URL}/fornecedor-voz", json={"status": "talvez"})
    extra = client.patch(f"{DECISION_URL}/fornecedor-voz", json={"title": "Outro"})
    missing = client.patch(f"{DECISION_URL}/nao-existe", json={"notes": "x"})

    assert empty.status_code == 422
    assert empty.json()["error_code"] == "EMPTY_UPDATE"
    assert nulls.json()["error_code"] == "EMPTY_UPDATE"
    assert invalid.status_code == 422
    assert extra.status_code == 422
    assert missing.status_code == 404
    assert missing.json()["error_code"] == "DARK_DECISION_NOT_FOUND"
    assert client.get(STRUCTURE_URL).json()["is_default"] is True


def test_decision_patch_requires_permission(permission_client):
    client, _ = permission_client
    assert client.patch(f"{DECISION_URL}/fornecedor-voz", json={"notes": "x"}).status_code == 401
    login(client, "viewer@mediamind.ai")

    response = client.patch(f"{DECISION_URL}/fornecedor-voz", json={"notes": "x"})

    assert response.status_code == 403


def test_decision_patch_cannot_touch_another_tenant(permission_client):
    client, ids = permission_client
    login(client)
    client.put(STRUCTURE_URL, json=_structure_body(decisions=[_decision("so-da-a")]))

    _login_other_tenant_writer(client, ids)
    response = client.patch(
        f"{DECISION_URL}/so-da-a", json={"status": "decidida", "answer": "Invadido"}
    )

    assert response.status_code == 404
    tenant_a = _tenant_records(ids, "tenant", "EstruturaCanaisDark")[0]
    assert tenant_a.data["decisions"][0]["status"] == "pendente"
    assert tenant_a.data["decisions"][0]["answer"] == ""
    assert _tenant_records(ids, "other", "EstruturaCanaisDark") == []


# --- Importação e exportação com decisões ---


def test_reimport_preserves_answers_taken_on_screen(permission_client):
    client, ids = permission_client
    login(client)
    package = client.get("/api/v1/dark-channels/structure/templates/padrao").json()
    client.post(IMPORT_URL, json={"package": package, "dry_run": False})
    client.patch(
        f"{DECISION_URL}/fornecedor-voz",
        json={"status": "decidida", "answer": "ElevenLabs", "notes": "Conta criada"},
    )
    decided_at = client.get(STRUCTURE_URL).json()["decisions"][2]["decided_at"]

    package["decisions"][2]["title"] = "Fornecedor de voz (revisado)"
    package["decisions"][3] = {
        **package["decisions"][3],
        "status": "decidida",
        "answer": "Banco de vídeo licenciado",
        "decided_at": "2026-10-01T10:00:00+00:00",
    }
    package["decisions"] = [item for item in package["decisions"] if item["id"] != "declaracao-ia"]
    preview = client.post(IMPORT_URL, json={"package": package})
    assert preview.json()["structure"]["decisions_count"] == 7
    assert preview.json()["structure"]["decisions_pending"] == 5

    client.post(IMPORT_URL, json={"package": package, "dry_run": False})
    decisions = {item["id"]: item for item in client.get(STRUCTURE_URL).json()["decisions"]}

    voz = decisions["fornecedor-voz"]
    assert voz["title"] == "Fornecedor de voz (revisado)"
    assert voz["status"] == "decidida"
    assert voz["answer"] == "ElevenLabs"
    assert voz["notes"] == "Conta criada"
    assert voz["decided_at"] == decided_at
    assert decisions["fornecedor-visual"]["answer"] == "Banco de vídeo licenciado"
    assert decisions["fornecedor-visual"]["decided_at"] == "2026-10-01T10:00:00+00:00"
    assert "declaracao-ia" not in decisions
    assert len(_tenant_records(ids, "tenant", "EstruturaCanaisDark")) == 1


def test_import_decided_without_timestamp_gets_server_time(permission_client):
    client, _ = permission_client
    login(client)
    package = {
        **_import_fixture(),
        "decisions": [_decision("voz", status="decidida", answer="A")],
    }
    client.post(IMPORT_URL, json={"package": package, "dry_run": False})
    first = client.get(STRUCTURE_URL).json()["decisions"][0]["decided_at"]
    assert first

    # Mesma resposta já decidida: mantém o horário original.
    package["decisions"][0]["decided_at"] = "2020-01-01T00:00:00+00:00"
    client.post(IMPORT_URL, json={"package": package, "dry_run": False})
    assert client.get(STRUCTURE_URL).json()["decisions"][0]["decided_at"] == first

    invalid = {
        **_import_fixture(),
        "decisions": [_decision("voz", status="decidida", answer="A", decided_at="ontem")],
    }
    assert client.post(IMPORT_URL, json={"package": invalid}).status_code == 422
    no_tz = {
        **_import_fixture(),
        "decisions": [
            _decision("voz", status="decidida", answer="A", decided_at="2026-10-01T10:00:00")
        ],
    }
    assert client.post(IMPORT_URL, json={"package": no_tz}).status_code == 422


def test_import_without_decisions_key_keeps_saved_decisions(permission_client):
    client, _ = permission_client
    login(client)
    client.patch(f"{DECISION_URL}/fornecedor-voz", json={"status": "decidida", "answer": "A"})

    response = client.post(IMPORT_URL, json={"package": _import_fixture(), "dry_run": False})

    assert response.json()["structure"]["decisions_count"] == 8
    assert response.json()["structure"]["decisions_pending"] == 7
    decisions = client.get(STRUCTURE_URL).json()["decisions"]
    assert decisions[2]["answer"] == "A"


def test_import_rejects_duplicate_decision_ids(permission_client):
    client, _ = permission_client
    login(client)
    package = {**_import_fixture(), "decisions": [_decision("x"), _decision("x")]}

    assert client.post(IMPORT_URL, json={"package": package}).status_code == 422


def test_export_round_trip_includes_decisions_and_language_fields(permission_client):
    client, ids = permission_client
    login(client)
    client.put(STRUCTURE_URL, json=_structure_body())
    client.patch(f"{DECISION_URL}/voz", json={"status": "decidida", "answer": "ElevenLabs"})

    package = client.get("/api/v1/dark-channels/structure/export").json()
    assert [item["id"] for item in package["decisions"]] == ["voz", "cadencia"]
    assert package["decisions"][0]["answer"] == "ElevenLabs"
    assert package["languages"][1]["enabled"] is False

    _login_other_tenant_writer(client, ids)
    client.post(IMPORT_URL, json={"package": package, "dry_run": False})
    re_exported = client.get("/api/v1/dark-channels/structure/export").json()

    assert re_exported["decisions"] == package["decisions"]
    assert re_exported["languages"] == package["languages"]
    assert re_exported["niches"] == package["niches"]

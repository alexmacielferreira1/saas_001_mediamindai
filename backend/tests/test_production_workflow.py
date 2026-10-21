# ruff: noqa: F811

import pytest
from app.core.errors import PublicError
from app.models.identity import TenantRecord
from app.services.production_workflow import check_stage_transition
from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


INITIAL_STAGES = {"rascunho", "agendamentos", "gravacoes", "gravacao", "para_editar"}


def create_project(client, etapa="rascunho", **extra):
    data = {"titulo": "Episódio", "etapa": etapa, **extra}
    if etapa in INITIAL_STAGES:
        response = client.post("/api/v1/records/ProducaoProjeto", json={"data": data})
        assert response.status_code == 201
        return response.json()["id"]
    # Advanced stages only arrive through the initial bulk seed (company without projects).
    return seed_projects(client, [data])[0]


def seed_projects(client, items):
    response = client.post("/api/v1/records/ProducaoProjeto/bulk", json={"items": items})
    assert response.status_code == 201, response.text
    return [record["id"] for record in response.json()["records"]]


def patch(client, record_id, data):
    return client.patch(f"/api/v1/records/ProducaoProjeto/{record_id}", json={"data": data})


@pytest.mark.parametrize(
    ("current", "target"),
    [
        ("rascunho", "agendamentos"),
        ("agendamentos", "rascunho"),
        ("agendamentos", "gravacoes"),
        ("gravacoes", "para_editar"),
        ("para_editar", "em_edicao"),
        ("em_edicao", "em_aprovacao"),
        ("em_aprovacao", "finalizado"),
        ("finalizado", "em_aprovacao"),
        ("finalizado", "redes_sociais"),
        ("redes_sociais", "para_publicar"),
        ("para_publicar", "publicado"),
        ("publicado", "analytics"),
        ("analytics", "publicado"),
        # Registrar gravação direto do rascunho (RascunhosPage).
        ("rascunho", "gravacoes"),
        # Fila "Alteração" e retorno da revisão.
        ("em_aprovacao", "aguardando_aprovacao"),
        ("aguardando_aprovacao", "em_aprovacao"),
        ("em_edicao", "aguardando_aprovacao"),
        ("aguardando_aprovacao", "em_edicao"),
        ("para_editar", "em_aprovacao"),
        ("em_aprovacao", "para_editar"),
        # Ajuste/regravação solicitado pela edição.
        ("para_editar", "gravacoes"),
        ("em_edicao", "gravacoes"),
        ("aguardando_aprovacao", "gravacoes"),
        # Estados legados.
        ("aguardando", "em_aprovacao"),
        ("publicacoes", "analytics"),
        ("em_aprovacao", "aguardando"),
    ],
)
def test_allowed_transitions_mirror_the_frontend_workflow(current, target):
    assert check_stage_transition({"etapa": current}, {"etapa": target}) == (current, target)


@pytest.mark.parametrize(
    ("current", "target"),
    [
        ("rascunho", "finalizado"),
        ("rascunho", "em_edicao"),
        ("agendamentos", "para_editar"),
        ("gravacoes", "em_aprovacao"),
        ("aguardando_aprovacao", "finalizado"),
        ("para_editar", "finalizado"),
        ("em_aprovacao", "redes_sociais"),
        ("finalizado", "analytics"),
        ("analytics", "rascunho"),
        ("gravacoes", "rascunho"),
    ],
)
def test_jumps_outside_the_workflow_are_rejected(current, target):
    with pytest.raises(PublicError) as error:
        check_stage_transition({"etapa": current}, {"etapa": target})
    assert error.value.status == 409
    assert error.value.code == "PRODUCTION_STAGE_TRANSITION_INVALID"


def test_unchanged_or_missing_stage_is_not_a_transition():
    assert check_stage_transition({"etapa": "em_edicao"}, {"titulo": "Novo"}) is None
    assert check_stage_transition({"etapa": "em_edicao"}, {"etapa": "em_edicao"}) is None
    # Sem etapa gravada o frontend trata como rascunho.
    assert check_stage_transition({}, {"etapa": "agendamentos"}) == (None, "agendamentos")
    with pytest.raises(PublicError):
        check_stage_transition({}, {"etapa": "finalizado"})


def test_unknown_target_stage_is_invalid_input():
    for value in ("qualquer", "", None, 3):
        with pytest.raises(PublicError) as error:
            check_stage_transition({"etapa": "rascunho"}, {"etapa": value})
        assert error.value.status == 422
        assert error.value.code == "PRODUCTION_STAGE_INVALID"


def test_legacy_gravacao_stage_resolves_like_the_frontend():
    scheduled = {"etapa": "gravacao", "gravada": False}
    recorded = {"etapa": "gravacao", "grav_status": "gravada"}
    assert check_stage_transition(scheduled, {"etapa": "gravacoes"})
    assert check_stage_transition(scheduled, {"etapa": "rascunho"})
    with pytest.raises(PublicError):
        check_stage_transition(scheduled, {"etapa": "para_editar"})
    assert check_stage_transition(recorded, {"etapa": "para_editar"})
    # Alvo legado "gravacao" equivale à etapa de agendamento/gravação resolvida.
    assert check_stage_transition({"etapa": "rascunho"}, {"etapa": "gravacao"})


def test_unclassified_legacy_stage_can_be_reclassified():
    assert check_stage_transition({"etapa": "revisao_antiga"}, {"etapa": "em_edicao"}) == (
        "revisao_antiga",
        "em_edicao",
    )


def test_api_accepts_valid_transition_and_audits_it(permission_client):
    client, ids = permission_client
    login(client)
    record_id = create_project(client)

    response = patch(client, record_id, {"etapa": "agendamentos", "titulo": "Com agenda"})

    assert response.status_code == 200
    assert response.json()["etapa"] == "agendamentos"
    logs = client.get("/api/v1/records/LogAuditoria").json()["records"]
    stage_logs = [log for log in logs if log["action"] == "production.stage_changed"]
    assert len(stage_logs) == 1
    assert stage_logs[0]["entity_id"] == record_id
    assert stage_logs[0]["details"] == {"from": "rascunho", "to": "agendamentos"}
    assert stage_logs[0]["user_id"]


def test_api_rejects_jump_without_changing_the_record(permission_client):
    client, _ = permission_client
    login(client)
    record_id = create_project(client)

    response = patch(client, record_id, {"etapa": "finalizado", "titulo": "Pulou"})

    assert response.status_code == 409
    assert response.json()["error_code"] == "PRODUCTION_STAGE_TRANSITION_INVALID"
    stored = client.get(f"/api/v1/records/ProducaoProjeto/{record_id}").json()
    assert stored["etapa"] == "rascunho"
    assert stored["titulo"] == "Episódio"
    logs = client.get("/api/v1/records/LogAuditoria").json()["records"]
    assert not [log for log in logs if log["action"] == "production.stage_changed"]


def test_api_keeps_creation_and_other_fields_free(permission_client):
    client, _ = permission_client
    login(client)
    # Criação em qualquer etapa inicial (ex.: EdicaoPage cria em "para_editar").
    record_id = create_project(client, etapa="para_editar")
    # Reenvio completo do registro com a mesma etapa (persist do producaoStore).
    response = patch(client, record_id, {"etapa": "para_editar", "pauta": "Nova pauta"})
    assert response.status_code == 200
    assert response.json()["pauta"] == "Nova pauta"
    # Outras entidades não passam pela regra.
    other = client.post("/api/v1/records/AgendaEvento", json={"data": {"etapa": "rascunho"}})
    changed = client.patch(
        f"/api/v1/records/AgendaEvento/{other.json()['id']}", json={"data": {"etapa": "fim"}}
    )
    assert changed.status_code == 200


def test_api_accepts_legacy_stage_transition(permission_client):
    client, _ = permission_client
    login(client)
    record_id = create_project(client, etapa="gravacao", gravada=True)

    assert patch(client, record_id, {"etapa": "para_editar"}).status_code == 200


def test_bulk_update_validates_every_matched_project(permission_client):
    client, _ = permission_client
    login(client)
    first, second = seed_projects(
        client,
        [
            {"titulo": "Episódio", "etapa": "em_aprovacao", "lote": "a"},
            {"titulo": "Episódio", "etapa": "em_edicao", "lote": "a"},
        ],
    )

    rejected = client.patch(
        "/api/v1/records/ProducaoProjeto/bulk",
        json={"filters": {"lote": "a"}, "data": {"etapa": "finalizado"}},
    )
    assert rejected.status_code == 409
    assert client.get(f"/api/v1/records/ProducaoProjeto/{first}").json()["etapa"] == (
        "em_aprovacao"
    )
    assert client.get(f"/api/v1/records/ProducaoProjeto/{second}").json()["etapa"] == ("em_edicao")

    accepted = client.patch(
        "/api/v1/records/ProducaoProjeto/bulk",
        json={"filters": {"lote": "a"}, "data": {"etapa": "aguardando_aprovacao"}},
    )
    assert accepted.json()["updated"] == 2
    logs = client.get("/api/v1/records/LogAuditoria").json()["records"]
    details = [log["details"] for log in logs if log["action"] == "production.stage_changed"]
    assert {"from": "em_aprovacao", "to": "aguardando_aprovacao"} in details
    assert {"from": "em_edicao", "to": "aguardando_aprovacao"} in details


def test_project_from_another_company_cannot_be_moved(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        foreign = TenantRecord(
            tenant_id=ids["other"], entity_type="ProducaoProjeto", data={"etapa": "rascunho"}
        )
        session.add(foreign)
        session.commit()
        foreign_id = foreign.id
    login(client)

    response = patch(client, foreign_id, {"etapa": "agendamentos"})
    bulk = client.patch(
        "/api/v1/records/ProducaoProjeto/bulk",
        json={"filters": {"etapa": "rascunho"}, "data": {"etapa": "agendamentos"}},
    )

    assert response.status_code == 404
    assert bulk.json()["updated"] == 0
    with ids["session_factory"]() as session:
        assert session.get(TenantRecord, foreign_id).data["etapa"] == "rascunho"
        audit = [
            row
            for row in session.query(TenantRecord).filter_by(entity_type="LogAuditoria")
            if row.data["action"] == "production.stage_changed"
        ]
        assert audit == []


def test_viewer_cannot_move_projects(permission_client):
    client, _ = permission_client
    login(client)
    record_id = create_project(client)
    client.post("/api/v1/auth/logout")
    login(client, "viewer@mediamind.ai")

    assert patch(client, record_id, {"etapa": "agendamentos"}).status_code == 403


@pytest.mark.parametrize(
    ("etapa", "extra"),
    [
        ("rascunho", {}),
        ("agendamentos", {}),
        ("gravacoes", {}),
        ("gravacao", {}),
        ("para_editar", {}),
        (None, {}),
    ],
)
def test_create_accepts_the_stages_the_creation_screens_use(permission_client, etapa, extra):
    client, _ = permission_client
    login(client)
    data = {"titulo": "Novo", **extra}
    if etapa is not None:
        data["etapa"] = etapa

    response = client.post("/api/v1/records/ProducaoProjeto", json={"data": data})

    assert response.status_code == 201


@pytest.mark.parametrize("etapa", ["publicado", "finalizado", "em_aprovacao", "analytics"])
def test_create_directly_in_an_advanced_stage_is_refused(permission_client, etapa):
    client, _ = permission_client
    login(client)

    response = client.post(
        "/api/v1/records/ProducaoProjeto", json={"data": {"titulo": "Pulou", "etapa": etapa}}
    )

    assert response.status_code == 409
    assert response.json()["error_code"] == "PRODUCTION_STAGE_CREATE_INVALID"
    assert client.get("/api/v1/records/ProducaoProjeto").json()["records"] == []


@pytest.mark.parametrize("route", ["single", "bulk"])
def test_unknown_stage_cannot_be_created_to_later_skip_the_workflow(permission_client, route):
    client, _ = permission_client
    login(client)
    data = {"titulo": "Truque", "etapa": "x"}

    if route == "single":
        response = client.post("/api/v1/records/ProducaoProjeto", json={"data": data})
    else:
        response = client.post(
            "/api/v1/records/ProducaoProjeto/bulk",
            json={"items": [{"titulo": "Ok", "etapa": "rascunho"}, data]},
        )

    assert response.status_code == 422
    assert response.json()["error_code"] == "PRODUCTION_STAGE_INVALID"
    # Nothing is written (no partial bulk insert).
    assert client.get("/api/v1/records/ProducaoProjeto").json()["records"] == []
    # Gravada flag resolves the legacy stage, but an invalid type is still refused.
    numeric = client.post("/api/v1/records/ProducaoProjeto", json={"data": {"etapa": 3}})
    assert numeric.status_code == 422


def test_other_entities_are_created_in_any_stage(permission_client):
    client, _ = permission_client
    login(client)

    response = client.post("/api/v1/records/AgendaEvento", json={"data": {"etapa": "fim"}})

    assert response.status_code == 201


def test_bulk_seed_accepts_advanced_stages_only_while_the_company_has_no_projects(
    permission_client,
):
    client, _ = permission_client
    login(client)

    seeded = client.post(
        "/api/v1/records/ProducaoProjeto/bulk",
        json={
            "items": [{"titulo": "A", "etapa": "publicado"}, {"titulo": "B", "etapa": "em_edicao"}]
        },
    )
    assert seeded.status_code == 201

    # Depois da semeadura o lote segue a regra da criação unitária.
    refused = client.post(
        "/api/v1/records/ProducaoProjeto/bulk",
        json={
            "items": [{"titulo": "C", "etapa": "rascunho"}, {"titulo": "D", "etapa": "publicado"}]
        },
    )
    assert refused.status_code == 409
    assert refused.json()["error_code"] == "PRODUCTION_STAGE_CREATE_INVALID"
    titles = {
        item["titulo"] for item in client.get("/api/v1/records/ProducaoProjeto").json()["records"]
    }
    assert titles == {"A", "B"}

    initial = client.post(
        "/api/v1/records/ProducaoProjeto/bulk",
        json={
            "items": [{"titulo": "E", "etapa": "rascunho"}, {"titulo": "F", "etapa": "para_editar"}]
        },
    )
    assert initial.status_code == 201


def test_bulk_seed_after_a_unit_creation_is_refused(permission_client):
    client, _ = permission_client
    login(client)
    create_project(client)

    response = client.post(
        "/api/v1/records/ProducaoProjeto/bulk",
        json={"items": [{"titulo": "Pulou", "etapa": "finalizado"}]},
    )

    assert response.status_code == 409
    assert len(client.get("/api/v1/records/ProducaoProjeto").json()["records"]) == 1


def test_projects_from_another_company_do_not_block_the_initial_seed(permission_client):
    client, ids = permission_client
    with ids["session_factory"]() as session:
        session.add(
            TenantRecord(
                tenant_id=ids["other"], entity_type="ProducaoProjeto", data={"etapa": "rascunho"}
            )
        )
        session.commit()
    login(client)

    response = client.post(
        "/api/v1/records/ProducaoProjeto/bulk",
        json={"items": [{"titulo": "Semente", "etapa": "publicado"}]},
    )

    assert response.status_code == 201
    with ids["session_factory"]() as session:
        foreign = [
            row
            for row in session.query(TenantRecord).filter_by(entity_type="ProducaoProjeto")
            if row.tenant_id == ids["other"]
        ]
        assert [row.data for row in foreign] == [{"etapa": "rascunho"}]


def test_other_entities_keep_bulk_creation_free(permission_client):
    client, _ = permission_client
    login(client)
    client.post("/api/v1/records/AgendaEvento", json={"data": {"etapa": "fim"}})

    response = client.post(
        "/api/v1/records/AgendaEvento/bulk", json={"items": [{"etapa": "publicado"}]}
    )

    assert response.status_code == 201

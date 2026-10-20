"""Canais Dark: campos de estrutura, modelos por empresa, importação e exportação."""

from test_permission_groups_api import PASSWORD

pytest_plugins = ["test_permission_groups_api"]

STRUCTURE_SCHEMA = "mediamind.dark-structure/v1"
IMPORT_URL = "/api/v1/dark-channels/structure/import"


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def _import_fixture():
    """Mesmo formato de canais_dark_import.json (reduzido a 3 canais)."""
    return {
        "schema": STRUCTURE_SCHEMA,
        "name": "Canais Dark — estrutura própria",
        "generated_at": "2026-10-20T12:00:00-03:00",
        "languages": [
            {
                "code": "pt-BR",
                "name": "Português (Brasil)",
                "regional_frame": "aberto",
                "notes": "Idioma de validação.",
            },
            {"code": "en-US", "name": "Inglês", "regional_frame": "aberto", "notes": ""},
        ],
        "niches": [
            {
                "code": "REL",
                "name": "Religioso / Bíblico",
                "subniches": ["versos", "historias", "jesus", "sabedoria"],
                "status": "ativo",
                "priority": 1,
                "notes": "Foco atual.",
            },
            {
                "code": "AUD",
                "name": "Técnicas de Audiovisual",
                "subniches": ["tecnicas"],
                "status": "planejado",
                "priority": 2,
                "notes": "",
            },
        ],
        "channels": [
            {
                "external_id": "rel-versos-pt-br",
                "name": "Palavra em Versos",
                "niche": "Religioso / Bíblico",
                "niche_code": "REL",
                "subniche": "versos",
                "language": "pt-BR",
                "audience": "Cristãos brasileiros que buscam conforto diário",
                "format": "shorts",
                "topic_folders": ["Salmos", "Provérbios"],
                "target_platforms": ["youtube", "tiktok", "instagram", "facebook"],
                "launch_wave": 1,
                "lifecycle_status": "planejado",
                "weekly_target": 5,
                "regional_frame": "aberto",
                "alt_names": ["Versículo Ilustrado", "Salmo e Luz"],
                "notes": "Canal de validação.",
            },
            {
                "external_id": "rel-historias-pt-br",
                "name": "Gênesis Ilustrado",
                "niche": "Religioso / Bíblico",
                "niche_code": "REL",
                "subniche": "historias",
                "language": "pt-BR",
                "audience": "Famílias e público geral",
                "format": "both",
                "topic_folders": ["Gênesis", "Êxodo"],
                "target_platforms": ["youtube", "tiktok"],
                "launch_wave": 2,
                "lifecycle_status": "ideia",
                "weekly_target": 3,
                "regional_frame": "aberto",
                "alt_names": ["Bíblia Ilustrada"],
                "notes": "",
            },
            {
                "external_id": "rel-versos-en-us",
                "name": "Verses of Light",
                "niche": "Religioso / Bíblico",
                "niche_code": "REL",
                "subniche": "versos",
                "language": "en-US",
                "audience": "English-speaking Christians",
                "format": "shorts",
                "topic_folders": ["Psalms"],
                "target_platforms": ["youtube"],
                "launch_wave": 3,
                "lifecycle_status": "em_espera",
                "weekly_target": 0,
                "regional_frame": "aberto",
                "alt_names": [],
                "notes": "",
            },
        ],
    }


FIXTURE_IDS = ["rel-versos-pt-br", "rel-historias-pt-br", "rel-versos-en-us"]


def _login_other_tenant_writer(client, ids):
    """Cria um usuário com production.write apenas na empresa B e faz login com ele."""
    from app.models.identity import Membership, Permission, PermissionGroup, User
    from app.security.passwords import hash_password
    from sqlalchemy import select

    with ids["session_factory"]() as session:
        user = User(
            email="b@outra.ai",
            email_normalized="b@outra.ai",
            password_hash=hash_password(PASSWORD),
        )
        group = PermissionGroup(tenant_id=ids["other"], name="Produção B")
        session.add_all([user, group])
        session.flush()
        group.permissions.append(
            session.scalar(select(Permission).where(Permission.code == "production.write"))
        )
        session.add(
            Membership(
                user_id=user.id,
                tenant_id=ids["other"],
                role="editor",
                permission_group_id=group.id,
            )
        )
        session.commit()
    client.post("/api/v1/auth/logout")
    login(client, "b@outra.ai")


def _tenant_records(ids, tenant_key, entity_type):
    from app.models.identity import TenantRecord
    from sqlalchemy import select

    with ids["session_factory"]() as session:
        return list(
            session.scalars(
                select(TenantRecord).where(
                    TenantRecord.tenant_id == ids[tenant_key],
                    TenantRecord.entity_type == entity_type,
                )
            )
        )


def _channel_by_external_id(client, external_id):
    channels = client.get("/api/v1/dark-channels").json()["channels"]
    return next(item for item in channels if item["external_id"] == external_id)


def test_tests_use_worktree_backend():
    import app

    assert "saas_001_mediamindai-canaisdark" in app.__file__


# --- Campos novos do canal ---


def test_channel_create_accepts_structure_fields_and_normalizes(permission_client):
    client, _ = permission_client
    login(client)

    response = client.post(
        "/api/v1/dark-channels",
        json={
            "name": "Palavra em Versos",
            "niche": "Religioso",
            "external_id": "rel-versos-pt-br",
            "niche_code": " REL ",
            "subniche": "versos",
            "lifecycle_status": "planejado",
            "launch_wave": 1,
            "weekly_target": 5,
            "regional_frame": "aberto",
            "target_platforms": ["youtube", "tiktok", "youtube"],
            "alt_names": [" Salmo e Luz ", "Salmo e Luz"],
            "notes": "Canal de validação.",
            "topic_folders": [" Salmos ", "Salmos", "Provérbios"],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["external_id"] == "rel-versos-pt-br"
    assert body["niche_code"] == "REL"
    assert body["subniche"] == "versos"
    assert body["lifecycle_status"] == "planejado"
    assert body["launch_wave"] == 1
    assert body["weekly_target"] == 5
    assert body["regional_frame"] == "aberto"
    assert body["target_platforms"] == ["youtube", "tiktok"]
    assert body["alt_names"] == ["Salmo e Luz"]
    assert body["notes"] == "Canal de validação."
    assert body["topic_folders"] == ["Salmos", "Provérbios"]
    assert body["materials"] == []
    assert body["archived"] is False

    minimal = client.post("/api/v1/dark-channels", json={"name": "Simples", "niche": "História"})
    assert minimal.status_code == 201
    assert minimal.json()["lifecycle_status"] == "ativo"
    assert minimal.json()["external_id"] is None
    assert minimal.json()["target_platforms"] == []
    assert minimal.json()["topic_folders"] == []


def test_channel_create_rejects_invalid_structure_fields(permission_client):
    client, _ = permission_client
    login(client)
    base = {"name": "Canal", "niche": "História"}
    invalid_payloads = [
        {"external_id": "Com Espaço"},
        {"external_id": "-comeca-com-hifen"},
        {"external_id": "a" * 81},
        {"lifecycle_status": "vivo"},
        {"launch_wave": 0},
        {"launch_wave": 100},
        {"weekly_target": 101},
        {"weekly_target": -1},
        {"target_platforms": ["orkut"]},
        {"alt_names": ["   "]},
        {"alt_names": ["x" * 121]},
        {"alt_names": [f"Nome {index}" for index in range(11)]},
        {"niche_code": "X" * 13},
        {"subniche": "x" * 81},
        {"regional_frame": "x" * 41},
        {"notes": "x" * 2001},
        {"topic_folders": ["  "]},
    ]
    for extra in invalid_payloads:
        response = client.post("/api/v1/dark-channels", json={**base, **extra})
        assert response.status_code == 422, extra
    assert client.get("/api/v1/dark-channels").json()["channels"] == []


def test_legacy_channel_without_new_fields_serializes_with_defaults(permission_client):
    client, ids = permission_client
    login(client)
    from app.models.identity import TenantRecord

    with ids["session_factory"]() as session:
        session.add(
            TenantRecord(
                tenant_id=ids["tenant"],
                entity_type="CanalDark",
                data={"name": "Antigo", "niche": "História", "publishing_mode": "manual"},
            )
        )
        session.commit()

    channel = client.get("/api/v1/dark-channels").json()["channels"][0]
    assert channel["name"] == "Antigo"
    assert channel["lifecycle_status"] == "ativo"
    assert channel["external_id"] is None
    assert channel["topic_folders"] == []
    assert channel["alt_names"] == []
    assert channel["weekly_target"] == 0
    assert channel["launch_wave"] is None
    assert channel["archived"] is False


def test_external_id_must_be_unique_per_tenant_including_archived(permission_client):
    client, _ = permission_client
    login(client)
    first = client.post(
        "/api/v1/dark-channels",
        json={"name": "Um", "niche": "História", "external_id": "canal-um"},
    ).json()
    client.patch(f"/api/v1/dark-channels/{first['id']}", json={"archived": True})
    second = client.post(
        "/api/v1/dark-channels",
        json={"name": "Dois", "niche": "História", "external_id": "canal-dois"},
    ).json()

    duplicate_create = client.post(
        "/api/v1/dark-channels",
        json={"name": "Cópia", "niche": "História", "external_id": "canal-um"},
    )
    duplicate_patch = client.patch(
        f"/api/v1/dark-channels/{second['id']}", json={"external_id": "canal-um"}
    )
    same_value = client.patch(
        f"/api/v1/dark-channels/{second['id']}",
        json={"external_id": "canal-dois", "lifecycle_status": "pausado", "weekly_target": 2},
    )

    assert duplicate_create.status_code == 409
    assert duplicate_create.json()["error_code"] == "DARK_CHANNEL_EXTERNAL_ID_CONFLICT"
    assert duplicate_patch.status_code == 409
    assert duplicate_patch.json()["error_code"] == "DARK_CHANNEL_EXTERNAL_ID_CONFLICT"
    assert same_value.status_code == 200
    assert same_value.json()["lifecycle_status"] == "pausado"
    assert same_value.json()["weekly_target"] == 2
    assert _channel_by_external_id(client, "canal-dois")["name"] == "Dois"


def test_external_id_can_repeat_across_tenants(permission_client):
    client, ids = permission_client
    login(client)
    created = client.post(
        "/api/v1/dark-channels",
        json={"name": "A", "niche": "História", "external_id": "mesmo-id"},
    )
    assert created.status_code == 201

    _login_other_tenant_writer(client, ids)
    other = client.post(
        "/api/v1/dark-channels",
        json={"name": "B", "niche": "História", "external_id": "mesmo-id"},
    )

    assert other.status_code == 201
    assert [item.data["name"] for item in _tenant_records(ids, "tenant", "CanalDark")] == ["A"]


def test_channel_patch_accepts_new_fields(permission_client):
    client, _ = permission_client
    login(client)
    channel = client.post(
        "/api/v1/dark-channels", json={"name": "Canal", "niche": "História"}
    ).json()

    response = client.patch(
        f"/api/v1/dark-channels/{channel['id']}",
        json={
            "external_id": "canal-novo",
            "niche_code": "HIS",
            "subniche": "antiga",
            "launch_wave": 4,
            "regional_frame": "aberto",
            "target_platforms": ["instagram", "instagram"],
            "alt_names": ["Outro nome"],
            "notes": "Observação",
        },
    )
    invalid = client.patch(f"/api/v1/dark-channels/{channel['id']}", json={"lifecycle_status": "x"})

    assert response.status_code == 200
    body = response.json()
    assert body["external_id"] == "canal-novo"
    assert body["niche_code"] == "HIS"
    assert body["target_platforms"] == ["instagram"]
    assert body["alt_names"] == ["Outro nome"]
    assert body["launch_wave"] == 4
    assert invalid.status_code == 422


def test_viewer_cannot_patch_new_fields(permission_client):
    client, _ = permission_client
    login(client)
    channel = client.post(
        "/api/v1/dark-channels", json={"name": "Canal", "niche": "História"}
    ).json()
    client.post("/api/v1/auth/logout")
    login(client, "viewer@mediamind.ai")

    response = client.patch(
        f"/api/v1/dark-channels/{channel['id']}", json={"external_id": "tomado"}
    )

    assert response.status_code == 403


# --- Estrutura e modelos ---


def test_structure_get_returns_default_template_without_writing(permission_client):
    client, ids = permission_client
    assert client.get("/api/v1/dark-channels/structure").status_code == 401
    login(client, "viewer@mediamind.ai")

    response = client.get("/api/v1/dark-channels/structure")

    assert response.status_code == 200
    body = response.json()
    assert body["is_default"] is True
    assert body["source"] == "padrao"
    assert body["template_id"] == "padrao"
    assert body["schema"] == STRUCTURE_SCHEMA
    assert body["updated_at"] is None
    assert len(body["niches"]) == 12
    assert len(body["languages"]) == 11
    assert "channels" not in body
    assert _tenant_records(ids, "tenant", "EstruturaCanaisDark") == []


def test_structure_routes_require_membership(permission_client):
    client, ids = permission_client
    from app.models.identity import Membership

    login(client, "viewer@mediamind.ai")
    with ids["session_factory"]() as session:
        session.delete(session.get(Membership, ids["viewer_membership"]))
        session.commit()

    for path in (
        "/api/v1/dark-channels/structure",
        "/api/v1/dark-channels/structure/templates",
        "/api/v1/dark-channels/structure/templates/padrao",
        "/api/v1/dark-channels/structure/export",
    ):
        response = client.get(path)
        assert response.status_code == 403, path


def test_structure_templates_list_and_detail(permission_client):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")

    listed = client.get("/api/v1/dark-channels/structure/templates")
    assert listed.status_code == 200
    templates = {item["id"]: item for item in listed.json()["templates"]}
    assert set(templates) == {"padrao", "religioso-multilingue"}
    assert templates["padrao"]["niches_count"] == 12
    assert templates["padrao"]["languages_count"] == 11
    assert templates["padrao"]["channels_count"] == 0
    assert templates["religioso-multilingue"]["niches_count"] == 1
    assert templates["religioso-multilingue"]["languages_count"] == 12
    assert templates["religioso-multilingue"]["channels_count"] == 0
    assert all(item["name"] and item["description"] for item in templates.values())

    padrao = client.get("/api/v1/dark-channels/structure/templates/padrao").json()
    assert padrao["schema"] == STRUCTURE_SCHEMA
    assert padrao["template_id"] == "padrao"
    assert padrao["channels"] == []
    assert {language["code"] for language in padrao["languages"]} == {
        "pt-BR",
        "en-US",
        "es-419",
        "fr-FR",
        "de-DE",
        "it-IT",
        "ja-JP",
        "ko-KR",
        "hi-IN",
        "id-ID",
        "ar",
    }
    assert all(language["regional_frame"] == "" for language in padrao["languages"])
    assert all(niche["subniches"] for niche in padrao["niches"])

    body = client.get("/api/v1/dark-channels/structure/templates/religioso-multilingue").json()
    assert body["channels"] == []
    assert body["niches"][0]["subniches"] == ["versos", "historias", "jesus", "sabedoria"]
    frames = {language["code"]: language["regional_frame"] for language in body["languages"]}
    assert frames == {
        "pt-BR": "aberto",
        "en-US": "aberto",
        "es-419": "aberto",
        "fr-FR": "aberto",
        "fil": "aberto",
        "ko-KR": "aberto",
        "sw": "aberto",
        "de-DE": "aberto",
        "it-IT": "aberto",
        "ru-RU": "aberto",
        "id-ID": "sabedoria_compartilhada",
        "ar": "aberto_curado",
    }

    missing = client.get("/api/v1/dark-channels/structure/templates/inexistente")
    assert missing.status_code == 404
    assert missing.json()["error_code"] == "DARK_TEMPLATE_NOT_FOUND"


def test_every_builtin_template_is_a_valid_import_package(permission_client):
    client, _ = permission_client
    login(client)
    for template_id in ("padrao", "religioso-multilingue"):
        package = client.get(f"/api/v1/dark-channels/structure/templates/{template_id}").json()
        response = client.post(IMPORT_URL, json={"package": package, "dry_run": True})
        assert response.status_code == 200, template_id
        assert response.json()["channels"]["created"] == []


def test_template_packages_are_independent_copies():
    from app.services.dark_structure_templates import get_template_package

    package = get_template_package("padrao")
    package["niches"].clear()

    assert get_template_package("padrao")["niches"]
    assert get_template_package("nao-existe") is None


# --- Importação ---


def test_import_dry_run_reports_without_writing(permission_client):
    client, ids = permission_client
    login(client)

    response = client.post(IMPORT_URL, json={"package": _import_fixture()})

    assert response.status_code == 200
    assert response.json() == {
        "dry_run": True,
        "structure": {
            "languages_count": 2,
            "niches_count": 2,
            "decisions_count": 0,
            "decisions_pending": 0,
        },
        "channels": {"created": FIXTURE_IDS, "updated": [], "unchanged": []},
        "errors": [],
    }
    assert _tenant_records(ids, "tenant", "CanalDark") == []
    assert _tenant_records(ids, "tenant", "EstruturaCanaisDark") == []
    assert _tenant_records(ids, "tenant", "LogAuditoria") == []


def test_import_creates_then_reimport_is_idempotent_and_updates(permission_client):
    client, ids = permission_client
    login(client)
    package = _import_fixture()

    created = client.post(IMPORT_URL, json={"package": package, "dry_run": False})
    assert created.status_code == 200
    assert created.json()["dry_run"] is False
    assert created.json()["channels"]["created"] == FIXTURE_IDS

    versos = _channel_by_external_id(client, "rel-versos-pt-br")
    assert versos["publishing_mode"] == "manual"
    assert versos["lifecycle_status"] == "planejado"
    assert versos["alt_names"] == ["Versículo Ilustrado", "Salmo e Luz"]
    assert versos["topic_folders"] == ["Salmos", "Provérbios"]
    assert versos["archived"] is False
    assert versos["materials"] == []

    structure = client.get("/api/v1/dark-channels/structure").json()
    assert structure["is_default"] is False
    assert structure["source"] == "importado"
    assert structure["template_id"] is None
    assert structure["name"] == package["name"]
    assert [niche["code"] for niche in structure["niches"]] == ["REL", "AUD"]
    assert structure["updated_at"]

    audits = _tenant_records(ids, "tenant", "LogAuditoria")
    assert [item.data["action"] for item in audits] == ["dark_structure.imported"]
    assert audits[0].data["details"] == {"created": 3, "updated": 0, "unchanged": 0}

    again = client.post(IMPORT_URL, json={"package": package, "dry_run": False})
    assert again.json()["channels"] == {"created": [], "updated": [], "unchanged": FIXTURE_IDS}

    # Automatizado e arquivado manualmente: a importação não altera esses campos
    # e não remove pastas existentes.
    client.patch(
        f"/api/v1/dark-channels/{versos['id']}",
        json={"publishing_mode": "automatic", "archived": True, "topic_folders": ["Manual"]},
    )
    package["channels"][0]["weekly_target"] = 7
    package["channels"][0]["topic_folders"] = ["Salmos", "Atos"]
    preview = client.post(IMPORT_URL, json={"package": package})
    assert preview.json()["channels"]["updated"] == ["rel-versos-pt-br"]
    assert _channel_by_external_id(client, "rel-versos-pt-br")["weekly_target"] == 5

    updated = client.post(IMPORT_URL, json={"package": package, "dry_run": False})
    assert updated.json()["channels"]["updated"] == ["rel-versos-pt-br"]
    refreshed = _channel_by_external_id(client, "rel-versos-pt-br")
    assert refreshed["weekly_target"] == 7
    assert refreshed["publishing_mode"] == "automatic"
    assert refreshed["archived"] is True
    assert refreshed["topic_folders"] == ["Manual", "Salmos", "Atos"]
    assert len(_tenant_records(ids, "tenant", "CanalDark")) == 3
    assert len(_tenant_records(ids, "tenant", "EstruturaCanaisDark")) == 1


def test_import_from_template_marks_source_padrao(permission_client):
    client, _ = permission_client
    login(client)
    package = client.get("/api/v1/dark-channels/structure/templates/religioso-multilingue").json()

    response = client.post(IMPORT_URL, json={"package": package, "dry_run": False})
    structure = client.get("/api/v1/dark-channels/structure").json()

    assert response.status_code == 200
    assert response.json()["structure"] == {
        "languages_count": 12,
        "niches_count": 1,
        "decisions_count": 10,
        "decisions_pending": 10,
    }
    assert structure["source"] == "padrao"
    assert structure["template_id"] == "religioso-multilingue"
    assert structure["is_default"] is False

    unknown = client.post(IMPORT_URL, json={"package": {**package, "template_id": "nao-existe"}})
    assert unknown.status_code == 422
    assert unknown.json()["error_code"] == "DARK_TEMPLATE_NOT_FOUND"


def test_import_rejects_invalid_packages(permission_client):
    client, _ = permission_client
    login(client)

    wrong_schema = {**_import_fixture(), "schema": "outro/v2"}
    duplicate = _import_fixture()
    duplicate["channels"][1]["external_id"] = "rel-versos-pt-br"
    missing_external_id = _import_fixture()
    del missing_external_id["channels"][0]["external_id"]
    publishing_mode = _import_fixture()
    publishing_mode["channels"][0]["publishing_mode"] = "automatic"
    duplicate_language = _import_fixture()
    duplicate_language["languages"].append(duplicate_language["languages"][0])
    duplicate_niche = _import_fixture()
    duplicate_niche["niches"].append(duplicate_niche["niches"][0])
    bad_subniche = _import_fixture()
    bad_subniche["niches"][0]["subniches"] = ["  "]
    bad_language = _import_fixture()
    bad_language["languages"][0]["name"] = "   "
    bad_channel = _import_fixture()
    bad_channel["channels"][0]["lifecycle_status"] = "vivo"

    for package in (
        wrong_schema,
        duplicate,
        missing_external_id,
        publishing_mode,
        duplicate_language,
        duplicate_niche,
        bad_subniche,
        bad_language,
        bad_channel,
    ):
        response = client.post(IMPORT_URL, json={"package": package, "dry_run": False})
        assert response.status_code == 422

    assert client.get("/api/v1/dark-channels").json()["channels"] == []
    assert client.get("/api/v1/dark-channels/structure").json()["is_default"] is True


def test_import_requires_production_permission(permission_client):
    client, _ = permission_client
    assert client.post(IMPORT_URL, json={"package": _import_fixture()}).status_code == 401
    login(client, "viewer@mediamind.ai")

    response = client.post(IMPORT_URL, json={"package": _import_fixture(), "dry_run": False})

    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"


def test_import_failure_rolls_back_everything(permission_client, monkeypatch):
    client, ids = permission_client
    login(client)
    from app.api.v1 import dark_channels

    def explode(*args, **kwargs):
        raise RuntimeError("falha simulada")

    monkeypatch.setattr(dark_channels, "_audit", explode)

    response = client.post(IMPORT_URL, json={"package": _import_fixture(), "dry_run": False})

    assert response.status_code == 500
    assert "falha simulada" not in response.text
    assert _tenant_records(ids, "tenant", "CanalDark") == []
    assert _tenant_records(ids, "tenant", "EstruturaCanaisDark") == []


def test_import_is_tenant_isolated(permission_client):
    client, ids = permission_client
    login(client)
    client.post(IMPORT_URL, json={"package": _import_fixture(), "dry_run": False})
    original = {
        item.data["external_id"]: dict(item.data)
        for item in _tenant_records(ids, "tenant", "CanalDark")
    }

    _login_other_tenant_writer(client, ids)
    assert client.get("/api/v1/dark-channels/structure").json()["is_default"] is True
    assert client.get("/api/v1/dark-channels").json()["channels"] == []
    exported = client.get("/api/v1/dark-channels/structure/export").json()
    assert exported["channels"] == []
    assert exported["name"] != _import_fixture()["name"]

    package = _import_fixture()
    package["channels"][0]["name"] = "Sequestro"
    response = client.post(IMPORT_URL, json={"package": package, "dry_run": False})

    assert response.json()["channels"]["created"] == FIXTURE_IDS
    after = {
        item.data["external_id"]: dict(item.data)
        for item in _tenant_records(ids, "tenant", "CanalDark")
    }
    assert after == original
    assert len(_tenant_records(ids, "other", "CanalDark")) == 3
    assert len(_tenant_records(ids, "tenant", "EstruturaCanaisDark")) == 1
    assert len(_tenant_records(ids, "other", "EstruturaCanaisDark")) == 1


# --- Exportação ---


def test_export_round_trip_to_another_tenant(permission_client):
    client, ids = permission_client
    login(client)
    client.post(IMPORT_URL, json={"package": _import_fixture(), "dry_run": False})
    # Canais sem external_id recebem identificador gerado (sem gravar) e sem colisão.
    client.post("/api/v1/dark-channels", json={"name": "Mistério Total!", "niche": "Mistério"})
    client.post("/api/v1/dark-channels", json={"name": "Mistério  Total", "niche": "Mistério"})
    client.post("/api/v1/dark-channels", json={"name": "???", "niche": "Mistério"})
    archived = client.post(
        "/api/v1/dark-channels", json={"name": "Arquivado", "niche": "Mistério"}
    ).json()
    client.patch(f"/api/v1/dark-channels/{archived['id']}", json={"archived": True})

    exported = client.get("/api/v1/dark-channels/structure/export")
    assert exported.status_code == 200
    package = exported.json()
    assert package["schema"] == STRUCTURE_SCHEMA
    assert package["generated_at"]
    assert package["name"] == _import_fixture()["name"]
    external_ids = [item["external_id"] for item in package["channels"]]
    assert sorted(external_ids) == sorted(
        [*FIXTURE_IDS, "misterio-total", "misterio-total-2", "canal"]
    )
    stored = [item.data.get("external_id") for item in _tenant_records(ids, "tenant", "CanalDark")]
    assert stored.count(None) == 4

    # Reimportar na mesma empresa associa pelos ids gerados, sem duplicar.
    same_tenant = client.post(IMPORT_URL, json={"package": package, "dry_run": False})
    assert same_tenant.json()["channels"]["created"] == []
    assert len(_tenant_records(ids, "tenant", "CanalDark")) == 7

    _login_other_tenant_writer(client, ids)
    imported = client.post(IMPORT_URL, json={"package": package, "dry_run": False})
    assert imported.status_code == 200
    assert sorted(imported.json()["channels"]["created"]) == sorted(external_ids)
    re_exported = client.get("/api/v1/dark-channels/structure/export").json()
    assert re_exported["languages"] == package["languages"]
    assert re_exported["niches"] == package["niches"]

    def by_id(items):
        return sorted(items, key=lambda item: item["external_id"])

    assert by_id(re_exported["channels"]) == by_id(package["channels"])


def test_export_without_saved_structure_uses_default_template(permission_client):
    client, _ = permission_client
    login(client, "viewer@mediamind.ai")

    package = client.get("/api/v1/dark-channels/structure/export").json()

    assert package["template_id"] == "padrao"
    assert len(package["niches"]) == 12
    assert package["channels"] == []


def test_generated_external_ids_skip_reserved_values_and_respect_length(permission_client):
    client, _ = permission_client
    login(client)
    long_name = "Nome " + "muito " * 30
    client.post("/api/v1/dark-channels", json={"name": "Canal", "niche": "X"})
    client.post(
        "/api/v1/dark-channels", json={"name": "Outro", "niche": "X", "external_id": "canal-2"}
    )
    client.post("/api/v1/dark-channels", json={"name": "Canal", "niche": "X"})
    client.post("/api/v1/dark-channels", json={"name": long_name[:120], "niche": "X"})
    client.post("/api/v1/dark-channels", json={"name": long_name[:120], "niche": "X"})

    external_ids = [
        item["external_id"]
        for item in client.get("/api/v1/dark-channels/structure/export").json()["channels"]
    ]

    assert external_ids[:3] == ["canal", "canal-2", "canal-3"]
    assert len(external_ids[3]) <= 80 and len(external_ids[4]) <= 80
    assert external_ids[4].endswith("-2")
    assert external_ids[3] != external_ids[4]


# --- Regras já existentes do módulo (cobertura de validações) ---


def test_channel_patch_null_and_text_fields(permission_client):
    client, _ = permission_client
    login(client)
    channel = client.post(
        "/api/v1/dark-channels", json={"name": "Canal", "niche": "História"}
    ).json()
    url = f"/api/v1/dark-channels/{channel['id']}"

    renamed = client.patch(
        url, json={"name": " Novo nome ", "notes": None, "niche": None, "topic_folders": None}
    )
    empty_name = client.patch(url, json={"name": "   "})
    null_materials = client.patch(url, json={"materials": None, "weekly_target": 1})

    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Novo nome"
    assert empty_name.status_code == 422
    assert null_materials.status_code == 200
    assert null_materials.json()["materials"] == []


def test_dark_script_validation_rules(permission_client):
    client, _ = permission_client
    login(client)
    channel = client.post(
        "/api/v1/dark-channels", json={"name": "Canal", "niche": "História"}
    ).json()
    other = client.post("/api/v1/dark-channels", json={"name": "Outro", "niche": "História"}).json()
    base = f"/api/v1/dark-channels/{channel['id']}/scripts"
    script = client.post(base, json={"topic": "Tema"}).json()
    other_script = client.post(
        f"/api/v1/dark-channels/{other['id']}/scripts", json={"topic": "Tema"}
    ).json()
    url = f"{base}/{script['id']}"

    assert client.post(base, json={"topic": "   "}).status_code == 422
    assert client.patch(url, json={"topic": "   "}).status_code == 422
    assert client.patch(url, json={"topic": None, "title": "Título"}).status_code == 200
    assert client.patch(url, json={"topic": " Novo tema "}).json()["topic"] == "Novo tema"
    invalid_workflows = [
        {"materials": [{"title": "  ", "reference": "https://a.b", "kind": "link"}]},
        {"cuts": [{"label": "Corte", "start_seconds": 10, "end_seconds": 5}]},
        {"thumbnail_reference": "ftp://arquivo"},
        {"published_at": "2026-11-01T15:00:00"},
    ]
    for workflow in invalid_workflows:
        assert client.patch(url, json={"workflow": workflow}).status_code == 422, workflow

    metrics = client.patch(url, json={"workflow": {"metrics": {"views": 3}, "scheduled_at": ""}})
    assert metrics.json()["workflow"]["metrics"]["views"] == 3
    approved = client.patch(url, json={"status": "approved"})
    assert approved.json()["validation_status"] == "passed"

    cross_channel = client.patch(
        f"{base}/{other_script['id']}", json={"title": "Roteiro de outro canal"}
    )
    assert cross_channel.status_code == 404
    assert cross_channel.json()["error_code"] == "DARK_SCRIPT_NOT_FOUND"

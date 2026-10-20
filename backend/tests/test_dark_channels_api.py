from test_permission_groups_api import PASSWORD

pytest_plugins = ["test_permission_groups_api"]


def login(client, email="admin@mediamind.ai"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def test_dark_channel_workflow_persists_channel_script_and_review_state(permission_client):
    client, _ = permission_client
    login(client)

    channel_response = client.post(
        "/api/v1/dark-channels",
        json={
            "name": "Histórias da Ciência",
            "niche": "Ciência",
            "audience": "Curiosos adultos",
            "language": "pt-BR",
            "publishing_mode": "manual",
        },
    )

    assert channel_response.status_code == 201
    channel = channel_response.json()
    assert channel["name"] == "Histórias da Ciência"
    assert channel["publishing_mode"] == "manual"

    script_response = client.post(
        f"/api/v1/dark-channels/{channel['id']}/scripts",
        json={"topic": "Como as abelhas se orientam", "title": "O mapa invisível das abelhas"},
    )

    assert script_response.status_code == 201
    script = script_response.json()
    assert script["channel_id"] == channel["id"]
    assert script["status"] == "draft"
    assert script["validation_status"] == "pending"
    assert script["publication_status"] == "not_ready"

    update = client.patch(
        f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}",
        json={"script": "A versão revisada do roteiro.", "status": "in_review"},
    )
    assert update.status_code == 200
    assert update.json()["script"] == "A versão revisada do roteiro."
    assert update.json()["status"] == "in_review"

    listed = client.get(f"/api/v1/dark-channels/{channel['id']}/scripts")
    assert [item["id"] for item in listed.json()["scripts"]] == [script["id"]]


def test_dark_channel_rejects_invalid_settings_and_empty_required_fields(permission_client):
    client, _ = permission_client
    login(client)

    invalid_mode = client.post(
        "/api/v1/dark-channels",
        json={"name": "Canal", "niche": "História", "publishing_mode": "instant"},
    )
    empty_name = client.post(
        "/api/v1/dark-channels",
        json={"name": "   ", "niche": "História", "publishing_mode": "manual"},
    )

    assert invalid_mode.status_code == 422
    assert empty_name.status_code == 422


def test_dark_channel_requires_auth_and_production_permission(permission_client):
    client, _ = permission_client

    assert client.get("/api/v1/dark-channels").status_code == 401

    login(client, "viewer@mediamind.ai")
    denied = client.post(
        "/api/v1/dark-channels",
        json={"name": "Canal", "niche": "História", "publishing_mode": "manual"},
    )
    assert denied.status_code == 403
    assert denied.json()["error_code"] == "PERMISSION_DENIED"


def test_dark_script_cannot_be_created_under_another_tenants_channel(permission_client):
    client, ids = permission_client
    login(client)
    channel_id = client.post(
        "/api/v1/dark-channels",
        json={"name": "Privado", "niche": "História", "publishing_mode": "manual"},
    ).json()["id"]

    with ids["session_factory"]() as session:
        from app.models.identity import TenantRecord

        other_channel = TenantRecord(
            tenant_id=ids["other"],
            entity_type="CanalDark",
            data={"name": "Outro tenant", "publishing_mode": "manual"},
        )
        session.add(other_channel)
        session.commit()
        other_channel_id = str(other_channel.id)

    response = client.post(
        f"/api/v1/dark-channels/{other_channel_id}/scripts",
        json={"topic": "Tentativa cruzada", "title": "Roteiro"},
    )

    assert response.status_code == 404
    assert client.get(f"/api/v1/dark-channels/{channel_id}/scripts").json()["scripts"] == []


def test_publication_mode_requires_publishing_permission(permission_client):
    client, _ = permission_client
    login(client)
    channel_id = client.post(
        "/api/v1/dark-channels",
        json={"name": "Canal", "niche": "História", "publishing_mode": "manual"},
    ).json()["id"]
    client.post("/api/v1/auth/logout")
    login(client, "viewer@mediamind.ai")

    response = client.patch(
        f"/api/v1/dark-channels/{channel_id}",
        json={"publishing_mode": "automatic"},
    )

    assert response.status_code == 403


def test_dark_channel_patch_does_not_persist_explicit_nulls(permission_client):
    client, _ = permission_client
    login(client)
    channel_id = client.post(
        "/api/v1/dark-channels",
        json={"name": "Canal", "niche": "História", "publishing_mode": "manual"},
    ).json()["id"]

    response = client.patch(
        f"/api/v1/dark-channels/{channel_id}",
        json={"publishing_mode": None},
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "EMPTY_UPDATE"
    current = client.get("/api/v1/dark-channels").json()["channels"][0]
    assert current["publishing_mode"] == "manual"

    script = client.post(
        f"/api/v1/dark-channels/{channel_id}/scripts",
        json={"topic": "Tema"},
    ).json()
    null_script_update = client.patch(
        f"/api/v1/dark-channels/{channel_id}/scripts/{script['id']}",
        json={"status": None},
    )
    assert null_script_update.status_code == 422
    assert null_script_update.json()["error_code"] == "EMPTY_UPDATE"


def test_dark_workflow_data_is_tenant_scoped_and_persisted(permission_client):
    client, _ = permission_client
    login(client)
    channel = client.post(
        "/api/v1/dark-channels",
        json={"name": "Canal autônomo", "niche": "História"},
    ).json()
    client.patch(
        f"/api/v1/dark-channels/{channel['id']}",
        json={"topic_folders": ["Civilizações antigas"]},
    )
    script = client.post(
        f"/api/v1/dark-channels/{channel['id']}/scripts", json={"topic": "Tema próprio"}
    ).json()
    workflow = {
        "folder_name": "Civilizações antigas",
        "final_title": "",
        "materials": [
            {
                "title": "Referência visual",
                "reference": "https://example.com/image.jpg",
                "kind": "image",
            }
        ],
        "thumbnail_title": "A cidade perdida",
        "thumbnail_reference": "",
        "video_format": "9:16",
        "target_channels": ["youtube", "instagram"],
        "description": "Descrição para o canal dark",
        "tags": ["história", "mistério"],
        "cuts": [{"label": "Short 1", "start_seconds": 12, "end_seconds": 42}],
        "scheduled_at": "2026-11-01T15:00:00-03:00",
        "publication_url": "https://youtube.com/watch?v=abc123",
        "published_at": "2026-11-01T15:00:00-03:00",
        "metrics": {"views": 1200, "likes": 75, "comments": 8},
    }

    saved = client.patch(
        f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}",
        json={"workflow": workflow},
    )

    assert saved.status_code == 200
    assert saved.json()["workflow"] == workflow
    assert (
        client.get(f"/api/v1/dark-channels/{channel['id']}/scripts").json()["scripts"][0][
            "workflow"
        ]
        == workflow
    )
    assert (
        client.get(f"/api/v1/dark-channels/{channel['id']}/scripts").json()["scripts"][0][
            "channel_id"
        ]
        == channel["id"]
    )


def test_dark_workflow_rejects_unknown_metadata_and_invalid_material_url(permission_client):
    client, _ = permission_client
    login(client)
    channel = client.post(
        "/api/v1/dark-channels", json={"name": "Canal", "niche": "História"}
    ).json()
    script = client.post(
        f"/api/v1/dark-channels/{channel['id']}/scripts", json={"topic": "Tema"}
    ).json()

    unknown = client.patch(
        f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}",
        json={"workflow": {"unmodeled": "value"}},
    )
    unsafe_url = client.patch(
        f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}",
        json={
            "workflow": {
                "materials": [
                    {"title": "Inválido", "reference": "javascript:alert(1)", "kind": "link"}
                ]
            }
        },
    )
    invalid_channel = client.patch(
        f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}",
        json={"workflow": {"target_channels": ["unknown-network"]}},
    )
    invalid_schedule = client.patch(
        f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}",
        json={"workflow": {"scheduled_at": "tomorrow afternoon"}},
    )

    assert unknown.status_code == 422
    assert unsafe_url.status_code == 422
    assert invalid_channel.status_code == 422
    assert invalid_schedule.status_code == 422


def test_dark_topic_folders_are_normalized_and_owned_by_channel(permission_client):
    client, _ = permission_client
    login(client)
    channel = client.post(
        "/api/v1/dark-channels", json={"name": "Canal", "niche": "História"}
    ).json()
    script = client.post(
        f"/api/v1/dark-channels/{channel['id']}/scripts", json={"topic": "Tema"}
    ).json()

    folders = client.patch(
        f"/api/v1/dark-channels/{channel['id']}",
        json={"topic_folders": [" História antiga ", "História antiga"]},
    )
    assigned = client.patch(
        f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}",
        json={"workflow": {"folder_name": "História antiga"}},
    )
    foreign_folder = client.patch(
        f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}",
        json={"workflow": {"folder_name": "Pasta de outro canal"}},
    )

    assert folders.json()["topic_folders"] == ["História antiga"]
    assert assigned.json()["workflow"]["folder_name"] == "História antiga"
    assert foreign_folder.status_code == 422


def test_dark_channel_materials_require_a_script_in_the_same_channel(permission_client):
    client, _ = permission_client
    login(client)
    channel = client.post(
        "/api/v1/dark-channels", json={"name": "Canal", "niche": "História"}
    ).json()

    other_channel = client.post(
        "/api/v1/dark-channels", json={"name": "Outro canal", "niche": "Ciência"}
    ).json()
    client.post(
        f"/api/v1/dark-channels/{other_channel['id']}/scripts", json={"topic": "Outro tema"}
    )
    materials = [
        {
            "title": "Entrevista",
            "reference": "https://media.example/entrevista.mp4",
            "kind": "video",
        },
        {"title": "Trilha", "reference": "https://media.example/trilha.wav", "kind": "audio"},
    ]
    rejected = client.patch(
        f"/api/v1/dark-channels/{channel['id']}",
        json={"materials": materials},
    )

    client.post(f"/api/v1/dark-channels/{channel['id']}/scripts", json={"topic": "Tema do canal"})
    saved = client.patch(f"/api/v1/dark-channels/{channel['id']}", json={"materials": materials})
    invalid = client.patch(
        f"/api/v1/dark-channels/{channel['id']}",
        json={
            "materials": [{"title": "Arquivo", "reference": "javascript:alert(1)", "kind": "video"}]
        },
    )

    assert rejected.status_code == 409
    assert rejected.json()["error_code"] == "DARK_SCRIPT_REQUIRED_FOR_MATERIALS"
    assert saved.status_code == 200
    assert [item["title"] for item in saved.json()["materials"]] == ["Entrevista", "Trilha"]
    assert invalid.status_code == 422


def test_dark_schedule_requires_publishing_permission(permission_client):
    client, _ = permission_client
    login(client)
    channel = client.post(
        "/api/v1/dark-channels", json={"name": "Canal", "niche": "História"}
    ).json()
    script = client.post(
        f"/api/v1/dark-channels/{channel['id']}/scripts", json={"topic": "Tema"}
    ).json()
    client.post("/api/v1/auth/logout")
    login(client, "viewer@mediamind.ai")

    response = client.patch(
        f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}",
        json={"workflow": {"scheduled_at": "2026-11-01T15:00:00-03:00"}},
    )
    channel_response = client.patch(
        f"/api/v1/dark-channels/{channel['id']}/scripts/{script['id']}",
        json={"workflow": {"target_channels": ["youtube"]}},
    )

    assert response.status_code == 403
    assert channel_response.status_code == 403

# ruff: noqa: F811

from test_permission_groups_api import login, permission_client  # noqa: F401


def test_dashboard_returns_role_specific_real_tenant_kpis(permission_client):
    client, _ = permission_client
    login(client, "admin@mediamind.ai")
    client.post(
        "/api/v1/records/ProducaoProjeto/bulk",
        json={
            "items": [
                {"titulo": "A", "etapa": "em_edicao"},
                {"titulo": "B", "etapa": "finalizado"},
            ]
        },
    )
    client.post("/api/v1/records/ProcessamentoJob", json={"data": {"status": "queued"}})
    client.post(
        "/api/v1/records/AgendaEvento",
        json={
            "data": {
                "titulo": "Gravação",
                "horario": "10:00",
                "day": 1,
                "status": "agendada",
            }
        },
    )

    response = client.get("/api/v1/dashboard/me")

    assert response.status_code == 200
    payload = response.json()
    assert payload["role"] == "admin"
    assert len(payload["kpis"]) == 8
    assert next(item for item in payload["kpis"] if item["id"] == "productions")["value"] == 2
    assert next(item for item in payload["kpis"] if item["id"] == "processing")["value"] == 1
    assert payload["upcoming_events"] == [expect_event("Gravação", "10:00")]


def expect_event(title, time):
    return {"title": title, "time": time, "status": "agendada", "project": ""}


def test_dashboard_requires_authentication(permission_client):
    client, _ = permission_client
    assert client.get("/api/v1/dashboard/me").status_code == 401

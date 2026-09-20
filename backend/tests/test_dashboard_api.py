from test_permission_groups_api import permission_client, login  # noqa: F401


def test_dashboard_returns_role_specific_real_tenant_kpis(permission_client):
    client, _ = permission_client
    login(client, "admin@mediamind.ai")
    client.post("/api/v1/records/ProducaoProjeto/bulk", json={"items": [
        {"titulo": "A", "etapa": "em_edicao"},
        {"titulo": "B", "etapa": "finalizado"},
    ]})
    client.post("/api/v1/records/ProcessamentoJob", json={"data": {"status": "queued"}})

    response = client.get("/api/v1/dashboard/me")

    assert response.status_code == 200
    payload = response.json()
    assert payload["role"] == "admin"
    assert len(payload["kpis"]) == 8
    assert next(item for item in payload["kpis"] if item["id"] == "productions")["value"] == 2
    assert next(item for item in payload["kpis"] if item["id"] == "processing")["value"] == 1


def test_dashboard_requires_authentication(permission_client):
    client, _ = permission_client
    assert client.get("/api/v1/dashboard/me").status_code == 401

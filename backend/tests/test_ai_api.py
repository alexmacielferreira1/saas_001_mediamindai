# ruff: noqa: F811

from test_permission_groups_api import login, permission_client  # noqa: F401


def test_ai_function_requires_authentication(permission_client):
    client, _ = permission_client

    response = client.post(
        "/api/v1/ai/functions/assistente_ia",
        json={"message": "Olá"},
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "AUTHENTICATION_REQUIRED"


def test_ai_function_reports_provider_not_configured(permission_client):
    client, _ = permission_client
    login(client, "admin@mediamind.ai")

    response = client.post(
        "/api/v1/ai/functions/assistente_ia",
        json={"message": "Olá"},
    )

    assert response.status_code == 503
    assert response.json()["error_code"] == "AI_PROVIDER_NOT_CONFIGURED"
    assert response.json()["retryable"] is False


def test_ai_function_rejects_unknown_legacy_function(permission_client):
    client, _ = permission_client
    login(client, "admin@mediamind.ai")

    response = client.post(
        "/api/v1/ai/functions/funcao_inexistente",
        json={},
    )

    assert response.status_code == 404
    assert response.json()["error_code"] == "AI_FUNCTION_NOT_FOUND"

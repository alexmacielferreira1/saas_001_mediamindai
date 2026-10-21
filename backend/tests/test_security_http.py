import pytest
from app.core.config import Settings, get_settings
from app.security.http import normalize_origin, trusted_origins
from test_auth_api import auth_client, login  # noqa: F401

EVIL = "https://evil.example.com"


def frontend_origin() -> str:
    return normalize_origin(get_settings().frontend_url)


def test_cookie_mutation_from_foreign_origin_is_rejected_and_session_survives(auth_client):  # noqa: F811
    client, _ = auth_client
    assert login(client).status_code == 200

    response = client.post("/api/v1/auth/logout", headers={"Origin": EVIL})

    assert response.status_code == 403
    assert response.json()["error_code"] == "CSRF_ORIGIN_REJECTED"
    assert client.get("/api/v1/auth/session").status_code == 200


def test_cookie_mutation_from_frontend_origin_is_allowed(auth_client):  # noqa: F811
    client, _ = auth_client
    assert login(client).status_code == 200

    response = client.post("/api/v1/auth/logout", headers={"Origin": frontend_origin()})

    assert response.status_code == 204


def test_cookie_mutation_without_origin_or_referer_is_rejected(auth_client):  # noqa: F811
    client, _ = auth_client
    assert login(client).status_code == 200
    client.headers.pop("Origin")

    response = client.post("/api/v1/auth/logout")

    assert response.status_code == 403
    assert client.get("/api/v1/auth/session").status_code == 200


def test_referer_from_trusted_origin_is_accepted_when_origin_is_absent(auth_client):  # noqa: F811
    client, _ = auth_client
    assert login(client).status_code == 200
    client.headers.pop("Origin")

    response = client.post(
        "/api/v1/auth/logout", headers={"Referer": f"{frontend_origin()}/corp?tab=producao"}
    )

    assert response.status_code == 204


@pytest.mark.parametrize("referer", [f"{EVIL}/page", "not a url"])
def test_untrusted_referer_is_rejected(auth_client, referer):  # noqa: F811
    client, _ = auth_client
    assert login(client).status_code == 200
    client.headers.pop("Origin")

    response = client.post("/api/v1/auth/logout", headers={"Referer": referer})

    assert response.status_code == 403


def test_opaque_null_origin_is_rejected(auth_client):  # noqa: F811
    client, _ = auth_client
    assert login(client).status_code == 200

    response = client.post("/api/v1/auth/logout", headers={"Origin": "null"})

    assert response.status_code == 403


def test_login_from_foreign_origin_is_rejected(auth_client):  # noqa: F811
    client, _ = auth_client

    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": EVIL},
        json={"email": "alexmacielferreira@gmail.com", "password": "senha-local-segura"},
    )

    assert response.status_code == 403
    assert "mediamind_session" not in response.headers.get("set-cookie", "")


def test_non_browser_client_without_cookie_or_origin_can_still_login(auth_client):  # noqa: F811
    client, _ = auth_client
    client.headers.pop("Origin")

    assert login(client).status_code == 200


def test_safe_methods_are_not_affected_by_foreign_origin(auth_client):  # noqa: F811
    client, _ = auth_client
    assert login(client).status_code == 200

    response = client.get("/api/v1/auth/session", headers={"Origin": EVIL})

    assert response.status_code == 200


def test_hub_machine_routes_are_exempt_from_origin_check(auth_client):  # noqa: F811
    client, _ = auth_client

    response = client.post(
        "/api/hub/v1/commands",
        headers={"Origin": EVIL, "Idempotency-Key": "x"},
        json={"action": "system.describe", "dry_run": True, "parameters": {}},
    )

    # Rejected by the bearer-token check, not by the browser CSRF rule.
    assert response.status_code == 401


def test_security_headers_are_present_on_success_and_error_responses(auth_client):  # noqa: F811
    client, _ = auth_client

    for response in (
        client.get("/health"),
        client.get("/api/v1/auth/session"),
        client.post("/api/v1/auth/logout", headers={"Origin": EVIL}),
    ):
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert response.headers["X-Frame-Options"] == "SAMEORIGIN"
        csp = response.headers["Content-Security-Policy"]
        assert csp.startswith("frame-ancestors 'self'")
        assert frontend_origin() in csp
        assert "camera=()" in response.headers["Permissions-Policy"]


def test_trusted_origins_in_production_do_not_include_loopback_aliases():
    settings = Settings(
        _env_file=None,
        environment="production",
        session_cookie_secure=True,
        frontend_url="https://mediamind.example.com/",
        hub_admin_token="token",
        csrf_trusted_origins="https://preview.example.com, ftp://bad.example.com,",
    )

    assert trusted_origins(settings) == frozenset(
        {"https://mediamind.example.com", "https://preview.example.com"}
    )


def test_local_trusted_origins_accept_localhost_alias_of_frontend():
    settings = Settings(_env_file=None, frontend_url="http://127.0.0.1:5173")

    assert {"http://127.0.0.1:5173", "http://localhost:5173"} <= trusted_origins(settings)


def test_local_alias_without_port():
    settings = Settings(_env_file=None, frontend_url="http://localhost")

    assert {"http://127.0.0.1", "http://localhost"} <= trusted_origins(settings)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("HTTPS://Example.com:443/path", "https://example.com"),
        ("http://example.com:8080", "http://example.com:8080"),
        ("http://example.com:99999", None),
        ("javascript:alert(1)", None),
        ("", None),
        (None, None),
    ],
)
def test_normalize_origin(value, expected):
    assert normalize_origin(value) == expected


def test_own_origin_requires_host_header():
    from app.security.http import own_origin
    from starlette.requests import Request

    request = Request({"type": "http", "scheme": "http", "headers": [], "path": "/"})

    assert own_origin(request) is None


def test_local_non_loopback_frontend_gets_no_aliases():
    settings = Settings(_env_file=None, frontend_url="https://staging.example.com")

    assert trusted_origins(settings) == frozenset({"https://staging.example.com"})

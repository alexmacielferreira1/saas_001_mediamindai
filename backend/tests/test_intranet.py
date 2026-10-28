"""Modo intranet: servidor da emissora em HTTP, tela compilada servida pela própria API."""

import pytest
from app.core.config import Settings, get_settings
from app.main import create_app
from fastapi.testclient import TestClient
from pydantic import ValidationError

KEY = "e8cmuwhOaq3xLtGsQvWnS0Wjzj1oFQ5qHgEzT8mrzJU="


def intranet_settings(**overrides):
    values = {"environment": "intranet", "ai_secret_key": KEY}
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_intranet_accepts_http_without_production_requirements():
    settings = intranet_settings(frontend_url="http://servidor-mm:8080")

    assert settings.environment == "intranet"
    assert settings.session_cookie_secure is False


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({"ai_secret_key": None}, "AI_SECRET_KEY"),
        ({"ai_secret_key": "  "}, "AI_SECRET_KEY"),
        ({"outbound_allow_private_networks": True}, "OUTBOUND_ALLOWED_HOSTS"),
    ],
)
def test_intranet_refuses_unsafe_configuration(overrides, expected):
    with pytest.raises(ValidationError, match=expected):
        intranet_settings(**overrides)


@pytest.fixture
def intranet_app(monkeypatch, tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>MediaMind</html>", encoding="utf-8")
    (dist / "assets" / "app-123.js").write_text("console.log('mm')", encoding="utf-8")
    (dist / "favicon.svg").write_text("<svg/>", encoding="utf-8")
    (tmp_path / "segredo.txt").write_text("fora da tela", encoding="utf-8")
    monkeypatch.setenv("ENVIRONMENT", "intranet")
    monkeypatch.setenv("AI_SECRET_KEY", KEY)
    monkeypatch.setenv("FRONTEND_DIST", str(dist))
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path / "media"))
    monkeypatch.setenv("OUTBOUND_ALLOW_PRIVATE_NETWORKS", "false")
    get_settings.cache_clear()
    with TestClient(create_app(), raise_server_exceptions=False) as client:
        yield client
    get_settings.cache_clear()


def test_screen_routes_files_and_api_share_one_origin(intranet_app):
    client = intranet_app

    home = client.get("/")
    assert home.status_code == 200
    assert home.text == "<html>MediaMind</html>"
    assert home.headers["cache-control"] == "no-cache"
    # Rotas do React Router abrem a tela (o navegador recarrega em qualquer página).
    assert client.get("/ingest/novo").text == "<html>MediaMind</html>"
    asset = client.get("/assets/app-123.js")
    assert asset.text == "console.log('mm')"
    assert asset.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert client.get("/favicon.svg").headers["cache-control"] == "no-cache"
    # Fora da pasta da tela nunca é servido.
    assert "fora da tela" not in client.get("/../segredo.txt").text
    assert "fora da tela" not in client.get("/%2e%2e/segredo.txt").text
    # A API continua respondendo JSON, inclusive 404 de rota inexistente.
    assert client.get("/health").json()["status"] == "ok"
    missing = client.get("/api/v1/nao-existe")
    assert missing.status_code == 404
    assert missing.json()["error_code"] == "NOT_FOUND"
    assert client.get("/api").status_code == 404


def test_any_lan_address_works_because_screen_and_api_share_the_origin(intranet_app):
    client = intranet_app
    for host in ("192.168.0.20:8080", "servidor-mm:8080"):
        same_origin = client.post(
            "/api/v1/auth/login",
            json={"email": "ninguem@emissora.test", "password": "senha-errada"},
            headers={"Host": host, "Origin": f"http://{host}"},
        )
        assert same_origin.status_code != 403, same_origin.text
    foreign = client.post(
        "/api/v1/auth/login",
        json={"email": "ninguem@emissora.test", "password": "senha-errada"},
        headers={"Host": "192.168.0.20:8080", "Origin": "http://site-estranho.test"},
    )
    assert foreign.status_code == 403
    assert foreign.json()["error_code"] == "CSRF_ORIGIN_REJECTED"


def test_intranet_has_no_demo_login_nor_unauthenticated_local_media(intranet_app):
    client = intranet_app
    assert client.post("/api/v1/auth/demo", json={"email": "admin@mediamind.ai"}).status_code == 404
    assert client.get("/api/v1/media/local/assets").status_code == 404


def test_missing_build_fails_with_clear_message(monkeypatch, tmp_path):
    monkeypatch.setenv("ENVIRONMENT", "intranet")
    monkeypatch.setenv("AI_SECRET_KEY", KEY)
    monkeypatch.setenv("FRONTEND_DIST", str(tmp_path / "vazia"))
    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="npm run build"):
        create_app()
    get_settings.cache_clear()

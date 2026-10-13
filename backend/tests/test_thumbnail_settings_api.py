# ruff: noqa: F811
from io import BytesIO

import httpx
import pytest
from app.core.config import get_settings
from app.models.identity import TenantRecord
from app.services.background_removal import normalized_image, remove_image_background
from cryptography.fernet import Fernet
from PIL import Image
from sqlalchemy import select
from test_permission_groups_api import PASSWORD, permission_client  # noqa: F401


def login(client, email="admin@mediamind.ai"):
    assert (
        client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD}).status_code
        == 200
    )


def png(transparent=True):
    image = Image.new("RGBA", (60, 80), (0, 0, 0, 0) if transparent else (30, 40, 50, 255))
    if transparent:
        for x in range(10, 50):
            for y in range(5, 75):
                image.putpixel((x, y), (230, 210, 190, 255))
    stream = BytesIO()
    image.save(stream, format="PNG")
    return stream.getvalue()


def test_settings_are_encrypted_and_never_accessible_via_generic_records(
    permission_client, monkeypatch
):
    client, ids = permission_client
    login(client)
    monkeypatch.setenv("THUMBNAIL_SECRET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    response = client.patch(
        "/api/v1/thumbnail-settings",
        json={"provider": "removebg", "api_key": "private-test-key", "monthly_limit": 2},
    )
    assert response.status_code == 200
    assert response.json()["key_configured"] is True
    assert "private-test-key" not in response.text
    with ids["session_factory"]() as session:
        record = session.scalar(
            select(TenantRecord).where(TenantRecord.entity_type == "ThumbnailAISettings")
        )
        assert "private-test-key" not in str(record.data)
    assert client.get("/api/v1/records/ThumbnailAISettings").status_code == 404
    login(client, "viewer@mediamind.ai")
    assert client.get("/api/v1/thumbnail-settings").json()["can_manage"] is False
    assert client.patch("/api/v1/thumbnail-settings", json={"provider": "local"}).status_code == 403
    get_settings.cache_clear()


def test_external_configuration_requires_server_secret(permission_client, monkeypatch):
    client, _ = permission_client
    login(client)
    monkeypatch.delenv("THUMBNAIL_SECRET_KEY", raising=False)
    get_settings.cache_clear()
    response = client.patch(
        "/api/v1/thumbnail-settings", json={"provider": "removebg", "api_key": "key"}
    )
    assert response.status_code == 503
    assert response.json()["error_code"] == "SECRET_STORAGE_NOT_CONFIGURED"


def test_transparent_input_is_reused_and_local_failures_are_clear(
    permission_client, monkeypatch, tmp_path
):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()
    response = client.post(
        "/api/v1/media/thumbnails/remove-background",
        files={"file": ("pessoa.png", png(), "image/png")},
    )
    assert response.status_code == 200
    assert normalized_image(response.content).size == (40, 70)
    assert (
        client.post(
            "/api/v1/media/thumbnails/remove-background",
            files={"file": ("bad.png", b"not-an-image", "image/png")},
        ).status_code
        == 422
    )
    get_settings.cache_clear()


def test_existing_alpha_is_preserved_without_loading_ai():
    assert normalized_image(remove_image_background(png())).size == (40, 70)
    with pytest.raises(Exception) as error:
        normalized_image(b"invalid")
    assert error.value.code == "INVALID_IMAGE"


@pytest.mark.parametrize("fails", [False, True])
def test_local_connection_validation(permission_client, monkeypatch, fails):
    client, _ = permission_client
    login(client)

    def load_model(model):
        assert model == "isnet-general-use"
        if fails:
            raise RuntimeError("model unavailable")
        return object()

    monkeypatch.setattr("app.api.v1.thumbnail_settings.get_background_removal_session", load_model)
    response = client.post("/api/v1/thumbnail-settings/test")
    assert response.status_code == (503 if fails else 200)
    if fails:
        assert response.json()["error_code"] == "CUTOUT_UNAVAILABLE"
    else:
        assert response.json()["ok"] is True


@pytest.mark.parametrize("outcome", [200, 401, "offline"])
def test_external_connection_validation(permission_client, monkeypatch, outcome):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("THUMBNAIL_SECRET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()

    class FakeClient:
        def __init__(self, **kwargs):
            assert kwargs["timeout"] == 20

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            pass

        async def get(self, url, headers):
            assert url.endswith("/account")
            assert headers == {"X-Api-Key": "test-key"}
            if outcome == "offline":
                raise httpx.ConnectError("offline")
            return httpx.Response(outcome)

    monkeypatch.setattr("app.api.v1.thumbnail_settings.httpx.AsyncClient", FakeClient)
    try:
        assert (
            client.patch(
                "/api/v1/thumbnail-settings", json={"provider": "removebg", "api_key": "test-key"}
            ).status_code
            == 200
        )
        response = client.post("/api/v1/thumbnail-settings/test")
        assert response.status_code == {200: 200, 401: 422, "offline": 503}[outcome]
        assert "test-key" not in response.text
    finally:
        get_settings.cache_clear()


def test_key_clear_requires_local_provider_and_corrupt_key_is_public_error(
    permission_client, monkeypatch
):
    from app.api.v1.thumbnail_settings import decrypt_key
    from app.core.errors import PublicError

    client, _ = permission_client
    login(client)
    monkeypatch.setenv("THUMBNAIL_SECRET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    try:
        with pytest.raises(PublicError) as missing:
            decrypt_key({})
        assert missing.value.code == "AI_KEY_REQUIRED"
        with pytest.raises(PublicError) as corrupt:
            decrypt_key({"encrypted_key": "invalid"})
        assert corrupt.value.code == "AI_KEY_UNREADABLE"
        assert (
            client.patch("/api/v1/thumbnail-settings", json={"provider": "removebg"}).status_code
            == 422
        )
        assert (
            client.patch(
                "/api/v1/thumbnail-settings", json={"provider": "removebg", "api_key": "test-key"}
            ).status_code
            == 200
        )
        assert (
            client.patch(
                "/api/v1/thumbnail-settings", json={"provider": "local", "clear_key": True}
            ).json()["key_configured"]
            is False
        )
    finally:
        get_settings.cache_clear()


def test_external_monthly_limit_and_cache(permission_client, monkeypatch, tmp_path):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("THUMBNAIL_SECRET_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()
    assert (
        client.patch(
            "/api/v1/thumbnail-settings",
            json={"provider": "removebg", "api_key": "key", "monthly_limit": 1},
        ).status_code
        == 200
    )
    calls = []

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            pass

        async def post(self, *args, **kwargs):
            calls.append((args, kwargs))

            class Result:
                status_code = 200
                content = png()

            return Result()

    monkeypatch.setattr("app.api.v1.thumbnail_settings.httpx.AsyncClient", FakeClient)
    for _ in range(2):
        response = client.post(
            "/api/v1/media/thumbnails/remove-background",
            files={"file": ("portrait.png", png(False), "image/png")},
        )
        assert response.status_code == 200
    assert len(calls) == 1
    other = Image.new("RGB", (60, 80), "red")
    buffer = BytesIO()
    other.save(buffer, "PNG")
    limited = client.post(
        "/api/v1/media/thumbnails/remove-background",
        files={"file": ("other.png", buffer.getvalue(), "image/png")},
    )
    assert limited.status_code == 429
    assert client.get("/api/v1/thumbnail-settings").json()["external_attempts_this_month"] == 1
    get_settings.cache_clear()

import pytest
from app.core.config import Settings
from pydantic import ValidationError


def production_settings(**overrides):
    values = {
        "environment": "production",
        "database_url": "postgresql+psycopg://user:password@db.example.com/mediamind",
        "frontend_url": "https://mediamind.example.com",
        "google_redirect_uri": "https://api.example.com/api/v1/auth/google/callback",
        "session_cookie_secure": True,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_production_environment_accepts_secure_login_configuration():
    settings = production_settings(google_client_id="client", google_client_secret="secret")

    assert settings.environment == "production"
    assert settings.session_cookie_secure is True


@pytest.mark.parametrize(
    ("overrides", "expected_error"),
    [
        ({"session_cookie_secure": False}, "SESSION_COOKIE_SECURE"),
        ({"frontend_url": "http://mediamind.example.com"}, "FRONTEND_URL"),
        (
            {
                "google_client_id": "client",
                "google_redirect_uri": "http://api.example.com/callback",
            },
            "GOOGLE_REDIRECT_URI",
        ),
        (
            {
                "google_client_secret": "secret",
                "google_redirect_uri": "http://api.example.com/callback",
            },
            "GOOGLE_REDIRECT_URI",
        ),
    ],
)
def test_production_rejects_insecure_auth_settings(overrides, expected_error):
    with pytest.raises(ValidationError, match=expected_error):
        production_settings(**overrides)

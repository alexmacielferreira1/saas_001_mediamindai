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
        "hub_admin_token": "production-token-from-secret-manager",
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


EMPTY_OPTIONAL_KEYS = (
    "HUB_ADMIN_TOKEN_EXPIRES_AT",
    "OUTBOUND_ALLOW_PRIVATE_NETWORKS",
    "CSRF_TRUSTED_ORIGINS",
    "HUB_ADMIN_SCOPES",
)


@pytest.fixture
def clean_optional_env(monkeypatch):
    for key in EMPTY_OPTIONAL_KEYS:
        monkeypatch.delenv(key, raising=False)


def test_env_example_copied_as_env_loads(clean_optional_env, monkeypatch, tmp_path):
    from app.core.config import ROOT

    # CI exports ENVIRONMENT=test, which would override the value read from the file.
    monkeypatch.delenv("ENVIRONMENT", raising=False)

    env_file = tmp_path / ".env"
    env_file.write_text((ROOT / ".env.example").read_text(encoding="utf-8"), encoding="utf-8")

    settings = Settings(_env_file=env_file)

    assert settings.environment == "local"
    assert settings.hub_admin_token_expires_at is None


def test_empty_optional_variables_mean_not_defined(clean_optional_env, tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("\n".join(f"{key}=" for key in EMPTY_OPTIONAL_KEYS), encoding="utf-8")

    settings = Settings(_env_file=env_file)

    assert settings.hub_admin_token_expires_at is None
    assert settings.outbound_allow_private_networks is False
    assert settings.csrf_trusted_origins == ""
    assert settings.hub_admin_scopes == "hub:observe hub:command"


def test_empty_optional_variables_from_process_environment(clean_optional_env, monkeypatch):
    for key in EMPTY_OPTIONAL_KEYS:
        monkeypatch.setenv(key, "  ")

    settings = Settings(_env_file=None)

    assert settings.hub_admin_token_expires_at is None
    assert settings.outbound_allow_private_networks is False
    assert settings.hub_admin_scope_set == frozenset({"hub:observe", "hub:command"})


def test_defined_optional_variables_are_still_parsed(clean_optional_env, tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "HUB_ADMIN_TOKEN_EXPIRES_AT=2027-01-31T23:59:59Z\n"
        "OUTBOUND_ALLOW_PRIVATE_NETWORKS=true\n"
        "HUB_ADMIN_SCOPES=hub:observe\n",
        encoding="utf-8",
    )

    settings = Settings(_env_file=env_file)

    assert settings.hub_admin_token_expires_at.year == 2027
    assert settings.outbound_allow_private_networks is True
    assert settings.hub_admin_scope_set == frozenset({"hub:observe"})


def test_missing_environment_fails_closed(monkeypatch):
    """Auditoria #5: sem ENVIRONMENT a API não pode subir como ``local`` (falha aberta)."""
    monkeypatch.delenv("ENVIRONMENT", raising=False)

    with pytest.raises(ValidationError, match="ENVIRONMENT"):
        Settings(_env_file=None)


@pytest.mark.parametrize("environment", ["", "   "])
def test_blank_environment_fails_closed(monkeypatch, environment):
    monkeypatch.setenv("ENVIRONMENT", environment)

    with pytest.raises(ValidationError, match="ENVIRONMENT"):
        Settings(_env_file=None)


@pytest.mark.parametrize("environment", ["local", "test"])
@pytest.mark.parametrize(
    "database_url",
    [
        "postgresql+psycopg://u:p@ep-cool-1234.sa-east-1.aws.neon.tech/mediamind",
        "postgresql+psycopg://u:p@dpg-abc123.oregon-postgres.render.com/mediamind",
    ],
)
def test_local_environment_refuses_managed_remote_database(environment, database_url):
    with pytest.raises(ValidationError, match="ENVIRONMENT"):
        Settings(_env_file=None, environment=environment, database_url=database_url)


def test_local_environment_keeps_local_database():
    settings = Settings(
        _env_file=None,
        environment="local",
        database_url="postgresql+psycopg://mediamind:x@127.0.0.1:5433/mediamind",
    )
    assert settings.environment == "local"

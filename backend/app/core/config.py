from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]
PRODUCT = "mediamind"
DEFAULT_DB_PORT = 5434 if PRODUCT == "central" else 5433


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    app_name: str = PRODUCT
    environment: Literal["local", "test", "staging", "production"] = "local"
    database_url: SecretStr = SecretStr(
        f"postgresql+psycopg://{PRODUCT}:local_dev_only@127.0.0.1:{DEFAULT_DB_PORT}/{PRODUCT}"
    )
    api_port: int = Field(default=8001 if PRODUCT == "central" else 8000, ge=1024, le=65535)
    frontend_port: int = Field(default=5174 if PRODUCT == "central" else 5173, ge=1024, le=65535)
    session_hours: int = Field(default=8, ge=1, le=168)
    session_cookie_secure: bool = False
    demo_password: SecretStr | None = None
    login_max_attempts: int = Field(default=5, ge=2, le=20)
    login_lockout_minutes: int = Field(default=15, ge=1, le=1440)
    frontend_url: str = "http://127.0.0.1:5173"
    google_client_id: str | None = None
    google_client_secret: SecretStr | None = None
    google_redirect_uri: str = "http://127.0.0.1:8000/api/v1/auth/google/callback"
    media_root: Path = ROOT / ".runtime" / "media"
    media_max_upload_bytes: int = Field(default=4 * 1024 * 1024 * 1024, ge=1)

    @model_validator(mode="after")
    def validate_production_auth(self) -> "Settings":
        if self.environment != "production":
            return self
        if not self.session_cookie_secure:
            raise ValueError("SESSION_COOKIE_SECURE deve ser true em production")
        if not self.frontend_url.startswith("https://"):
            raise ValueError("FRONTEND_URL deve usar HTTPS em production")
        if (
            self.google_client_id or self.google_client_secret
        ) and not self.google_redirect_uri.startswith("https://"):
            raise ValueError("GOOGLE_REDIRECT_URI deve usar HTTPS em production")
        return self

    @property
    def version(self) -> str:
        return (ROOT / "VERSION").read_text(encoding="utf-8").strip()


@lru_cache
def get_settings() -> Settings:
    return Settings()

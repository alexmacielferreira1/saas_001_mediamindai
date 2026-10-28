from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]
PRODUCT = "mediamind"
DEFAULT_DB_PORT = 5434 if PRODUCT == "central" else 5433
HUB_ADMIN_KNOWN_SCOPES = frozenset({"hub:observe", "hub:command"})
# Bancos gerenciados (produção/homologação). Com ENVIRONMENT local/test a API recusa subir
# apontando para eles: login demo, mídia sem autenticação e cookie sem Secure ficariam ativos.
MANAGED_DATABASE_HOST_SUFFIXES = (".neon.tech", ".render.com")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    app_name: str = PRODUCT
    # Sem padrão (auditoria 2026-10-23, #5): um deploy sem ENVIRONMENT não pode subir como
    # ``local``. Desenvolvimento local define ENVIRONMENT=local no .env (copiado do exemplo).
    environment: Literal["local", "test", "staging", "production"] | None = None
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
    hub_admin_token: SecretStr | None = None
    # Comandos locais dos cortes automáticos (transcrição/análise). Lidos também do .env:
    # antes só os.getenv era consultado e o valor do .env era ignorado.
    clips_transcriber_command: str | None = None
    clips_analysis_command: str | None = None
    hub_admin_audience: str = "central"
    # Scopes granted to HUB_ADMIN_TOKEN, defined only on the server (space separated).
    # The default matches the Central contract (observe + dry-run commands); restrict with
    # HUB_ADMIN_SCOPES="hub:observe" to deny commands. Callers can never widen this set.
    hub_admin_scopes: str = "hub:observe hub:command"
    hub_admin_token_expires_at: datetime | None = None
    # Extra browser origins trusted for cookie-authenticated mutations (comma separated).
    csrf_trusted_origins: str = ""
    # Local development only: let server-side calls reach private/loopback hosts.
    outbound_allow_private_networks: bool = False
    # Servidores internos liberados pelo administrador do servidor (ex.: Ollama), separados por
    # vírgula no formato host:porta ("127.0.0.1:11434"). Vale também em produção (intranet da
    # emissora): só esses endereços exatos, nunca a rede interna inteira.
    outbound_allowed_hosts: str = ""
    hub_product_id: str = "mediamind-ai"
    media_root: Path = ROOT / ".runtime" / "media"
    # Pasta de referência do Ingest (entrada). Cada empresa usa a subpasta com o próprio slug;
    # o arquivo é copiado para MEDIA_ROOT (destino) e o original na entrada não é alterado.
    ingest_source_root: Path | None = None
    media_max_upload_bytes: int = Field(default=4 * 1024 * 1024 * 1024, ge=1)
    ffmpeg_path: Path | None = None
    thumbnail_secret_key: SecretStr | None = None
    ai_secret_key: SecretStr | None = None

    @field_validator(
        "hub_admin_token_expires_at",
        "outbound_allow_private_networks",
        "csrf_trusted_origins",
        "hub_admin_scopes",
        "ingest_source_root",
        mode="before",
    )
    @classmethod
    def empty_optional_means_default(cls, value: object, info: ValidationInfo) -> object:
        # `VAR=` (copied from .env.example or left blank on the host) means "not defined":
        # fall back to the safe default instead of refusing to start the API.
        if isinstance(value, str) and not value.strip():
            return cls.model_fields[info.field_name].default
        return value

    @field_validator("environment", mode="before")
    @classmethod
    def blank_environment_is_missing(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode="after")
    def require_explicit_environment(self) -> "Settings":
        if self.environment is None:
            raise ValueError(
                "ENVIRONMENT deve ser definido explicitamente (local, test, staging ou production)"
            )
        if self.environment in {"local", "test"}:
            host = (urlsplit(self.database_url.get_secret_value()).hostname or "").lower()
            if host.endswith(MANAGED_DATABASE_HOST_SUFFIXES):
                raise ValueError(
                    "ENVIRONMENT local/test não pode usar banco gerenciado remoto; "
                    "defina ENVIRONMENT=production ou staging"
                )
        return self

    @field_validator("hub_admin_scopes")
    @classmethod
    def validate_hub_admin_scopes(cls, value: str) -> str:
        unknown = set(value.split()) - HUB_ADMIN_KNOWN_SCOPES
        if unknown:
            raise ValueError("HUB_ADMIN_SCOPES contém escopo desconhecido")
        return value

    @field_validator("hub_admin_token_expires_at")
    @classmethod
    def validate_hub_admin_expiry(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value

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
        if self.hub_admin_token is None or not self.hub_admin_token.get_secret_value().strip():
            raise ValueError("HUB_ADMIN_TOKEN deve ser configurado em production")
        if self.outbound_allow_private_networks:
            raise ValueError("OUTBOUND_ALLOW_PRIVATE_NETWORKS não é permitido em production")
        return self

    @property
    def hub_admin_scope_set(self) -> frozenset[str]:
        return frozenset(self.hub_admin_scopes.split())

    @property
    def version(self) -> str:
        return (ROOT / "VERSION").read_text(encoding="utf-8").strip()


@lru_cache
def get_settings() -> Settings:
    return Settings()

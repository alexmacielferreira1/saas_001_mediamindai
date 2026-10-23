from time import perf_counter
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, HttpUrl, SecretStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.ai_usage import guard_budget, record_usage
from app.api.v1.records import add_audit
from app.core.config import get_settings
from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import Tenant, TenantRecord
from app.repositories.identity import get_active_membership, list_active_memberships
from app.security.outbound import OutboundUrlRejected, validate_outbound_url
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import effective_permissions, require_permission

router = APIRouter(prefix="/ai", tags=["ai"])
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
DbSession = Annotated[Session, Depends(get_session)]
SETTINGS_ENTITY = "AISettings"
DEFAULT_AI_SETTINGS = {
    "provider": "compatible",
    "base_url": "https://api.openai.com/v1",
    "model": "gpt-image-1",
}


class AISettingsPatch(BaseModel):
    provider: Literal["compatible"] = "compatible"
    base_url: HttpUrl
    model: str = Field(min_length=1, max_length=120)
    api_key: SecretStr | None = None
    clear_key: bool = False


AI_TOOL_IDS = {
    "image-generator",
    "video-generator",
    "object-generator",
    "world-generator",
    "thumbnails",
    "carousel",
    "frames",
    "auto-clips",
    "video-studio",
    "speech-montage",
    "sales-videos",
    "affiliate-videos",
    "trend-radar",
    "animated-videos",
    "voice-studio",
    "channel-studio",
    "ai-dubbing",
    "assistant",
    "transcription",
    "automation",
    "ocr",
    "semantic-search",
    "media-analysis",
    "script-writing",
    "captions",
}


class AIConnection(BaseModel):
    id: str | None = Field(default=None, max_length=80)
    name: str = Field(min_length=1, max_length=100)
    provider: Literal["compatible", "anthropic"] = "compatible"
    base_url: HttpUrl
    model: str = Field(min_length=1, max_length=120)
    enabled: bool = True
    api_key: SecretStr | None = None


class AIConnectionsPatch(BaseModel):
    connections: list[AIConnection] = Field(max_length=30)
    default_connection_id: str | None = None
    tool_connections: dict[str, str | None] = Field(default_factory=dict)


def require_safe_ai_destination(base_url: str) -> str:
    """Guard de SSRF para o destino de IA configurado pela empresa (auditoria #3).

    Usado ao salvar a conexão e logo antes de cada chamada ao provedor.
    """
    try:
        validate_outbound_url(base_url)
    except OutboundUrlRejected as error:
        raise PublicError(
            422,
            "AI_DESTINATION_BLOCKED",
            "O endereço da IA não é permitido. Use um provedor público em http(s).",
        ) from error
    return base_url


def connection_configuration(data):
    if "connections" in data:
        return data
    return {
        "connections": [
            {"id": "legacy", "name": "IA principal", "enabled": True, **DEFAULT_AI_SETTINGS, **data}
        ]
        if data.get("encrypted_key")
        else [],
        "default_connection_id": "legacy" if data.get("encrypted_key") else None,
        "tool_connections": {},
    }


def resolve_connection(data, tool_id):
    config = connection_configuration(data)
    selected = config.get("tool_connections", {}).get(tool_id, config.get("default_connection_id"))
    return next(
        (
            item
            for item in config["connections"]
            if item["id"] == selected and item.get("enabled", True)
        ),
        {},
    )


def public_connections(data, can_manage):
    config = connection_configuration(data)
    return {
        "connections": [
            {
                key: item.get(key)
                for key in ("id", "name", "provider", "base_url", "model", "enabled")
            }
            | {"key_configured": bool(item.get("encrypted_key"))}
            for item in config["connections"]
        ],
        "default_connection_id": config.get("default_connection_id"),
        "tool_connections": config.get("tool_connections", {}),
        "can_manage": can_manage,
    }


def is_ai_superadmin(session, current):
    return any(
        member.role == "superadmin"
        for member, _tenant in list_active_memberships(session, current.user.id)
    )


def ai_tenant_scope(session, current, tenant_id=None, *, write=False):
    if is_ai_superadmin(session, current):
        identifier = tenant_id or current.auth_session.selected_tenant_id
        tenant = session.get(Tenant, identifier) if identifier else None
        if tenant is None or not tenant.is_active:
            raise PublicError(403, "TENANT_ACCESS_DENIED", "Selecione uma empresa ativa.")
        return tenant.id, True
    if tenant_id and tenant_id != current.auth_session.selected_tenant_id:
        row = get_active_membership(session, current.user.id, tenant_id)
        if row is None:
            raise PublicError(403, "TENANT_ACCESS_DENIED", "Acesso à empresa não autorizado.")
        membership, tenant = row
        current = CurrentSession(current.auth_session, current.user, membership, tenant)
    membership = require_membership(current)
    if write:
        require_permission(session, current, "permissions.manage")
    return membership.tenant_id, "permissions.manage" in effective_permissions(session, current)


@router.get("/companies")
def ai_companies(current: Authenticated, session: DbSession):
    superadmin = is_ai_superadmin(session, current)
    tenants = (
        list(
            session.scalars(select(Tenant).where(Tenant.is_active.is_(True)).order_by(Tenant.name))
        )
        if superadmin
        else [tenant for _member, tenant in list_active_memberships(session, current.user.id)]
    )
    return {
        "companies": [{"id": str(tenant.id), "name": tenant.name} for tenant in tenants],
        "is_superadmin": superadmin,
    }


@router.get("/connections")
def read_ai_connections(current: Authenticated, session: DbSession, tenant_id: UUID | None = None):
    identifier, can_manage = ai_tenant_scope(session, current, tenant_id)
    record = ai_settings_record(session, identifier)
    return public_connections(record.data if record else {}, can_manage)


@router.put("/connections")
def write_ai_connections(
    body: AIConnectionsPatch,
    current: Authenticated,
    session: DbSession,
    tenant_id: UUID | None = None,
):
    identifier, _can_manage = ai_tenant_scope(session, current, tenant_id, write=True)
    session.scalar(select(Tenant).where(Tenant.id == identifier).with_for_update())
    record = ai_settings_record(session, identifier, lock=True)
    previous = connection_configuration(record.data if record else {})
    old = {item["id"]: item for item in previous["connections"]}
    connections = []
    for item in body.connections:
        connection_id = item.id or str(uuid4())
        if connection_id in {entry["id"] for entry in connections}:
            raise PublicError(422, "AI_DUPLICATE_CONNECTION", "Existem conexões duplicadas.")
        data = item.model_dump(exclude={"api_key"})
        data.update(
            id=connection_id,
            name=item.name.strip(),
            model=item.model.strip(),
            base_url=str(item.base_url).rstrip("/"),
        )
        if not data["name"] or not data["model"]:
            raise PublicError(422, "AI_INVALID_CONNECTION", "Informe nome e modelo da conexão.")
        require_safe_ai_destination(data["base_url"])
        encrypted = old.get(connection_id, {}).get("encrypted_key")
        prior = old.get(connection_id, {})
        if prior and (
            prior.get("provider") != item.provider
            or prior.get("base_url", "").rstrip("/") != data["base_url"]
        ):
            encrypted = None
        if item.api_key and item.api_key.get_secret_value().strip():
            encrypted = (
                ai_cipher().encrypt(item.api_key.get_secret_value().strip().encode()).decode()
            )
        if not encrypted:
            raise PublicError(422, "AI_KEY_REQUIRED", "Informe a chave de cada nova conexão.")
        data["encrypted_key"] = encrypted
        connections.append(data)
    identifiers = {item["id"] for item in connections}
    targets = [body.default_connection_id, *body.tool_connections.values()]
    if any(target is not None and target not in identifiers for target in targets):
        raise PublicError(422, "AI_INVALID_ASSIGNMENT", "Escolha uma conexão desta empresa.")
    if set(body.tool_connections) - AI_TOOL_IDS:
        raise PublicError(422, "AI_INVALID_TOOL", "Ferramenta de IA não reconhecida.")
    data = {
        "connections": connections,
        "default_connection_id": body.default_connection_id,
        "tool_connections": body.tool_connections,
    }
    if record is None:
        record = TenantRecord(tenant_id=identifier, entity_type=SETTINGS_ENTITY, data=data)
        session.add(record)
        session.flush()
    else:
        record.data = data
    session.add(
        TenantRecord(
            tenant_id=identifier,
            entity_type="LogAuditoria",
            data={
                "action": "ai.connections_updated",
                "entity_type": SETTINGS_ENTITY,
                "entity_id": str(record.id),
                "user_id": str(current.user.id),
                "details": {
                    "connection_count": len(connections),
                    "assigned_tools": list(body.tool_connections),
                },
            },
        )
    )
    session.commit()
    return public_connections(data, True)


class ImageGenerationRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    aspect: Literal["1:1", "16:9", "9:16", "4:3"] = "1:1"
    count: int = Field(default=1, ge=1, le=4)


class VideoStudioGenerationRequest(BaseModel):
    stage: Literal[
        "roteiro",
        "elementos",
        "mood_style",
        "character_sheets",
        "shot_list",
        "storyboard",
        "prompts",
        "multiplanos",
    ]
    prompt: str = Field(min_length=1, max_length=240_000)
    connection_id: str | None = Field(default=None, max_length=80)
    max_tokens: int = Field(default=4000, ge=256, le=8192)


LEGACY_AI_FUNCTIONS = {
    "analisar_clipes_ia",
    "assistente_ia",
    "configurar_acesso_ia",
    "gerar_roteiro_ia",
    "resolve_pendencias",
    "transcrever_asset",
}


def ai_settings_record(session: Session, tenant_id, *, lock: bool = False):
    query = select(TenantRecord).where(
        TenantRecord.tenant_id == tenant_id,
        TenantRecord.entity_type == SETTINGS_ENTITY,
    )
    return session.scalar(query.with_for_update() if lock else query)


def ai_cipher() -> Fernet:
    settings = get_settings()
    secret = settings.ai_secret_key
    if not secret and settings.environment != "production":
        key_file = settings.media_root.parent / "ai-secret.key"
        key_file.parent.mkdir(parents=True, exist_ok=True)
        if not key_file.exists():
            key_file.write_bytes(Fernet.generate_key())
        secret = SecretStr(key_file.read_text(encoding="utf-8").strip())
    try:
        if not secret:
            raise ValueError()
        return Fernet(secret.get_secret_value().encode())
    except ValueError as error:
        raise PublicError(
            503,
            "SECRET_STORAGE_NOT_CONFIGURED",
            "Configure AI_SECRET_KEY no servidor para armazenar chaves de IA.",
        ) from error


def decrypt_ai_key(data: dict[str, Any]) -> str:
    encrypted = data.get("encrypted_key")
    if not encrypted:
        raise PublicError(503, "AI_PROVIDER_NOT_CONFIGURED", "Configure a API de IA deste cliente.")
    try:
        return ai_cipher().decrypt(encrypted.encode()).decode()
    except InvalidToken as error:
        raise PublicError(
            503,
            "AI_KEY_UNREADABLE",
            "Reconfigure a chave de IA deste cliente.",
        ) from error


async def generate_connection_text(
    data: dict[str, Any], prompt: str, *, max_tokens: int = 4000, return_usage: bool = False
) -> str | tuple[str, dict]:
    base_url = require_safe_ai_destination(data["base_url"].rstrip("/"))
    key = decrypt_ai_key(data)
    if data["provider"] == "anthropic":
        url = f"{base_url}/messages"
        headers = {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        }
        payload = {
            "model": data["model"],
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
    else:
        url = f"{base_url}/chat/completions"
        headers = {"content-type": "application/json", "authorization": f"Bearer {key}"}
        payload = {
            "model": data["model"],
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
    try:
        async with httpx.AsyncClient(timeout=120, follow_redirects=False) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
        result = response.json()
        if data["provider"] == "anthropic":
            if result.get("stop_reason") == "max_tokens":
                raise PublicError(
                    502,
                    "AI_OUTPUT_TRUNCATED",
                    "A resposta excedeu o limite de saída. Reduza o pedido e tente novamente.",
                )
            text = "\n".join(
                block.get("text", "")
                for block in result.get("content", [])
                if block.get("type") == "text"
            ).strip()
        else:
            choices = result.get("choices") or []
            if choices and choices[0].get("finish_reason") == "length":
                raise PublicError(
                    502,
                    "AI_OUTPUT_TRUNCATED",
                    "A resposta excedeu o limite de saída. Reduza o pedido e tente novamente.",
                )
            content = choices[0].get("message", {}).get("content") if choices else ""
            text = content.strip() if isinstance(content, str) else ""
        if not text:
            raise PublicError(502, "AI_INVALID_RESPONSE", "A IA não retornou texto.")
        return (text, result.get("usage", {})) if return_usage else text
    except PublicError:
        raise
    except httpx.HTTPStatusError as error:
        raise PublicError(
            422,
            "AI_GENERATION_REJECTED",
            "O provedor recusou a execução. Verifique chave, modelo e créditos.",
        ) from error
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as error:
        raise PublicError(
            503,
            "AI_PROVIDER_UNAVAILABLE",
            "O provedor de IA está indisponível ou respondeu em formato inválido.",
            retryable=True,
        ) from error


def public_ai_settings(data: dict[str, Any], *, can_manage: bool) -> dict[str, Any]:
    merged = {**DEFAULT_AI_SETTINGS, **data}
    return {
        "provider": merged["provider"],
        "base_url": merged["base_url"],
        "model": merged["model"],
        "key_configured": bool(data.get("encrypted_key")),
        "can_manage": can_manage,
    }


@router.get("/settings")
def read_ai_settings(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    record = ai_settings_record(session, membership.tenant_id)
    return public_ai_settings(
        resolve_connection(record.data if record else {}, "image-generator"),
        can_manage="permissions.manage" in effective_permissions(session, current),
    )


@router.patch("/settings")
def write_ai_settings(body: AISettingsPatch, current: Authenticated, session: DbSession):
    require_permission(session, current, "permissions.manage")
    membership = require_membership(current)
    require_safe_ai_destination(str(body.base_url).rstrip("/"))
    session.scalar(select(Tenant).where(Tenant.id == membership.tenant_id).with_for_update())
    record = ai_settings_record(session, membership.tenant_id, lock=True)
    if record and "connections" in record.data:
        raise PublicError(
            409, "AI_USE_CONNECTIONS", "Edite as conexões na configuração geral de IA."
        )
    if record is None:
        record = TenantRecord(
            tenant_id=membership.tenant_id,
            entity_type=SETTINGS_ENTITY,
            data={},
        )
        session.add(record)
        session.flush()
    data = {
        **record.data,
        "provider": body.provider,
        "base_url": str(body.base_url).rstrip("/"),
        "model": body.model.strip(),
    }
    if body.clear_key:
        data.pop("encrypted_key", None)
    if body.api_key and body.api_key.get_secret_value().strip():
        data["encrypted_key"] = (
            ai_cipher().encrypt(body.api_key.get_secret_value().strip().encode()).decode()
        )
    if not data.get("encrypted_key"):
        raise PublicError(422, "AI_KEY_REQUIRED", "Informe a chave da API de IA.")
    record.data = data
    add_audit(
        session,
        current,
        "ai.settings_updated",
        SETTINGS_ENTITY,
        str(record.id),
        {"provider": body.provider, "key_changed": bool(body.api_key or body.clear_key)},
    )
    session.commit()
    return public_ai_settings(data, can_manage=True)


@router.get("/generation/image/status")
def image_generation_status(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    record = ai_settings_record(session, membership.tenant_id)
    data = resolve_connection(record.data if record else {}, "image-generator")
    configured = bool(data.get("encrypted_key")) and image_connection_supported(data)
    return {
        "configured": configured,
        "provider": data["provider"] if configured else None,
        "model": data["model"] if configured else None,
    }


def image_size(aspect: str) -> str:
    return {
        "1:1": "1024x1024",
        "16:9": "1536x1024",
        "9:16": "1024x1536",
        "4:3": "1536x1024",
    }[aspect]


def image_connection_supported(data):
    return data.get("provider") == "compatible" and not (
        data.get("base_url", "").rstrip("/") == "https://api.openai.com/v1"
        and not data.get("model", "").startswith(("gpt-image-", "dall-e-"))
    )


@router.post("/generation/image")
async def generate_image(body: ImageGenerationRequest, current: Authenticated, session: DbSession):
    membership = require_membership(current)
    record = ai_settings_record(session, membership.tenant_id)
    data = resolve_connection(record.data if record else {}, "image-generator")
    key = decrypt_ai_key(data)
    require_safe_ai_destination(data["base_url"].rstrip("/"))
    if not image_connection_supported(data):
        raise PublicError(
            422,
            "AI_CAPABILITY_UNSUPPORTED",
            "Escolha uma IA de geração de imagens para esta ferramenta.",
        )
    guard_budget(
        session, membership.tenant_id, data["provider"], data["model"], image_count=body.count
    )
    ai_start = perf_counter()
    try:
        async with httpx.AsyncClient(timeout=120, follow_redirects=False) as client:
            response = await client.post(
                f"{data['base_url'].rstrip('/')}/images/generations",
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "model": data["model"],
                    "prompt": body.prompt,
                    "n": body.count,
                    "size": image_size(body.aspect),
                    "response_format": "b64_json",
                },
            )
            response.raise_for_status()
        result = response.json()
        images = []
        for item in result.get("data", []):
            if item.get("b64_json"):
                images.append({"url": f"data:image/png;base64,{item['b64_json']}"})
            elif item.get("url"):
                images.append({"url": item["url"]})
        if not images:
            raise PublicError(502, "AI_INVALID_RESPONSE", "O provedor não retornou uma imagem.")
    except PublicError as error:
        record_usage(
            session,
            membership.tenant_id,
            current.user.id,
            provider=data["provider"],
            model=data["model"],
            feature="image-generator",
            status="error",
            latency_ms=(perf_counter() - ai_start) * 1000,
            error_code=error.code if hasattr(error, "code") else type(error).__name__,
            connection_id=data.get("id"),
        )
        raise
    except httpx.HTTPStatusError as error:
        record_usage(
            session,
            membership.tenant_id,
            current.user.id,
            provider=data["provider"],
            model=data["model"],
            feature="image-generator",
            status="error",
            latency_ms=(perf_counter() - ai_start) * 1000,
            error_code="PROVIDER_HTTP_ERROR",
            connection_id=data.get("id"),
        )
        raise PublicError(
            422,
            "AI_GENERATION_REJECTED",
            "O provedor recusou a geração. Verifique chave, modelo e créditos.",
        ) from error
    except (httpx.HTTPError, ValueError) as error:
        record_usage(
            session,
            membership.tenant_id,
            current.user.id,
            provider=data["provider"],
            model=data["model"],
            feature="image-generator",
            status="error",
            latency_ms=(perf_counter() - ai_start) * 1000,
            error_code="PROVIDER_UNAVAILABLE",
            connection_id=data.get("id"),
        )
        raise PublicError(
            503,
            "AI_PROVIDER_UNAVAILABLE",
            "O provedor de IA está indisponível. Tente novamente.",
            retryable=True,
        ) from error
    record_usage(
        session,
        membership.tenant_id,
        current.user.id,
        provider=data["provider"],
        model=data["model"],
        feature="image-generator",
        latency_ms=(perf_counter() - ai_start) * 1000,
        images=len(images),
        connection_id=data.get("id"),
    )
    add_audit(
        session,
        current,
        "ai.image_generated",
        SETTINGS_ENTITY,
        str(record.id),
        {"provider": data["provider"], "model": data["model"], "count": len(images)},
    )
    session.commit()
    return {"images": images, "model": data["model"], "provider": data["provider"]}


@router.post("/generation/video-studio")
async def generate_video_studio_stage(
    body: VideoStudioGenerationRequest,
    current: Authenticated,
    session: DbSession,
):
    membership = require_membership(current)
    record = ai_settings_record(session, membership.tenant_id)
    configuration = connection_configuration(record.data if record else {})
    connection_id = body.connection_id or configuration.get("tool_connections", {}).get(
        "video-studio", configuration.get("default_connection_id")
    )
    data = next(
        (
            item
            for item in configuration["connections"]
            if item.get("id") == connection_id and item.get("enabled", True)
        ),
        None,
    )
    if data is None:
        if body.connection_id:
            raise PublicError(
                422,
                "AI_INVALID_ASSIGNMENT",
                "Escolha uma conexão de IA ativa desta empresa.",
            )
        raise PublicError(
            503,
            "AI_PROVIDER_NOT_CONFIGURED",
            "Cadastre ou selecione uma conexão de IA ativa para o Video Studio.",
        )
    base_url = require_safe_ai_destination(data["base_url"].rstrip("/"))
    key = decrypt_ai_key(data)
    if data["provider"] == "anthropic":
        url = f"{base_url}/messages"
        headers = {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        }
        payload = {
            "model": data["model"],
            "max_tokens": body.max_tokens,
            "messages": [{"role": "user", "content": body.prompt}],
        }
    else:
        url = f"{base_url}/chat/completions"
        headers = {"content-type": "application/json", "authorization": f"Bearer {key}"}
        payload = {
            "model": data["model"],
            "max_tokens": body.max_tokens,
            "messages": [{"role": "user", "content": body.prompt}],
        }
    guard_budget(
        session, membership.tenant_id, data["provider"], data["model"], max_tokens=body.max_tokens
    )
    ai_start = perf_counter()
    try:
        async with httpx.AsyncClient(timeout=120, follow_redirects=False) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
        result = response.json()
        if data["provider"] == "anthropic":
            if result.get("stop_reason") == "max_tokens":
                raise PublicError(
                    502,
                    "AI_OUTPUT_TRUNCATED",
                    "A resposta excedeu o limite de saída desta etapa. "
                    "Reduza o contexto e tente novamente.",
                )
            text = "\n".join(
                block.get("text", "")
                for block in result.get("content", [])
                if block.get("type") == "text"
            ).strip()
        else:
            choices = result.get("choices") or []
            if choices and choices[0].get("finish_reason") == "length":
                raise PublicError(
                    502,
                    "AI_OUTPUT_TRUNCATED",
                    "A resposta excedeu o limite de saída desta etapa. "
                    "Reduza o contexto e tente novamente.",
                )
            content = choices[0].get("message", {}).get("content") if choices else ""
            text = content.strip() if isinstance(content, str) else ""
        if not text:
            raise PublicError(
                502,
                "AI_INVALID_RESPONSE",
                "A IA não retornou texto para esta etapa. Tente novamente.",
            )
    except PublicError as error:
        record_usage(
            session,
            membership.tenant_id,
            current.user.id,
            provider=data["provider"],
            model=data["model"],
            feature="video-studio." + body.stage,
            status="error",
            latency_ms=(perf_counter() - ai_start) * 1000,
            error_code=getattr(error, "code", type(error).__name__),
            connection_id=data.get("id"),
        )
        raise
    except httpx.HTTPStatusError as error:
        record_usage(
            session,
            membership.tenant_id,
            current.user.id,
            provider=data["provider"],
            model=data["model"],
            feature="video-studio." + body.stage,
            status="error",
            latency_ms=(perf_counter() - ai_start) * 1000,
            error_code="PROVIDER_HTTP_ERROR",
            connection_id=data.get("id"),
        )
        raise PublicError(
            422,
            "AI_GENERATION_REJECTED",
            "O provedor recusou a etapa. Verifique chave, modelo e créditos.",
        ) from error
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, AttributeError) as error:
        record_usage(
            session,
            membership.tenant_id,
            current.user.id,
            provider=data["provider"],
            model=data["model"],
            feature="video-studio." + body.stage,
            status="error",
            latency_ms=(perf_counter() - ai_start) * 1000,
            error_code="PROVIDER_UNAVAILABLE",
            connection_id=data.get("id"),
        )
        raise PublicError(
            503,
            "AI_PROVIDER_UNAVAILABLE",
            "O provedor de IA está indisponível ou respondeu em formato inválido. Tente novamente.",
            retryable=True,
        ) from error
    usage = result.get("usage", {})
    inp = usage.get("input_tokens", usage.get("prompt_tokens", 0)) or 0
    out = usage.get("output_tokens", usage.get("completion_tokens", 0)) or 0
    record_usage(
        session,
        membership.tenant_id,
        current.user.id,
        provider=data["provider"],
        model=data["model"],
        feature="video-studio." + body.stage,
        latency_ms=(perf_counter() - ai_start) * 1000,
        input_tokens=inp,
        output_tokens=out,
        connection_id=data.get("id"),
        usage_known=bool(result.get("usage")),
    )
    add_audit(
        session,
        current,
        "ai.video_studio_stage_generated",
        SETTINGS_ENTITY,
        str(record.id),
        {"provider": data["provider"], "model": data["model"], "stage": body.stage},
    )
    session.commit()
    return {
        "text": text,
        "provider": data["provider"],
        "model": data["model"],
        "connection_id": data["id"],
    }


@router.post("/functions/{function_name}")
def invoke_ai_function(
    function_name: str,
    payload: dict[str, Any],
    current: Authenticated,
):
    require_membership(current)
    if function_name not in LEGACY_AI_FUNCTIONS:
        raise PublicError(404, "AI_FUNCTION_NOT_FOUND", "Função de IA não reconhecida.")

    # The payload is intentionally accepted but never logged. Provider selection,
    # secrets, quotas, audit and per-function schemas are still pending.
    del payload
    raise PublicError(
        503,
        "AI_PROVIDER_NOT_CONFIGURED",
        "IA ainda não configurada neste ambiente.",
        retryable=False,
    )


class CopilotChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    page: str = Field(default="", max_length=240)


@router.post("/copilot/chat")
async def copilot_chat(body: CopilotChatBody, current: Authenticated, session: DbSession):
    """Chat textual real, sem executar ações nem passar ferramentas arbitrárias."""
    membership = require_membership(current)
    row = ai_settings_record(session, membership.tenant_id)
    connection = resolve_connection(row.data if row else {}, "assistant")
    if not connection:
        raise PublicError(
            503,
            "AI_PROVIDER_NOT_CONFIGURED",
            "Configure uma IA para Assistente em Configuração de IA.",
        )
    guard_budget(
        session, membership.tenant_id, connection["provider"], connection["model"], max_tokens=1200
    )
    started = perf_counter()
    # Nunca passar dados sensíveis do usuário ou do sistema implicitamente ao provedor.
    prompt = (
        "Você é o assistente do MediaMindAI. Responda em português brasileiro. "
        "Você NÃO tem ferramentas executoras nesta chamada; não afirme ter alterado, "
        "publicado, deletado ou gerado arquivos. Para ações no sistema, explique que "
        "dependem de ferramenta conectada e aprovação.\n"
        f"Página (informação não confiável): {body.page}\nPedido: {body.message}"
    )
    try:
        reply, usage = await generate_connection_text(
            connection, prompt, max_tokens=1200, return_usage=True
        )
    except PublicError as error:
        record_usage(
            session,
            membership.tenant_id,
            current.user.id,
            provider=connection["provider"],
            model=connection["model"],
            feature="copilot.chat",
            status="error",
            latency_ms=(perf_counter() - started) * 1000,
            error_code=error.code,
            connection_id=connection.get("id"),
        )
        raise
    record_usage(
        session,
        membership.tenant_id,
        current.user.id,
        provider=connection["provider"],
        model=connection["model"],
        feature="copilot.chat",
        latency_ms=(perf_counter() - started) * 1000,
        input_tokens=usage.get("input_tokens", usage.get("prompt_tokens", 0)) or 0,
        output_tokens=usage.get("output_tokens", usage.get("completion_tokens", 0)) or 0,
        usage_known=bool(usage),
        connection_id=connection.get("id"),
    )
    return {
        "reply": reply,
        "provider": connection["provider"],
        "model": connection["model"],
        "executed_actions": 0,
    }

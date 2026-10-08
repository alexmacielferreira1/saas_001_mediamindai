import hashlib
from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import uuid4

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.v1.records import add_audit
from app.core.config import get_settings
from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import Tenant, TenantRecord
from app.services.background_removal import (
    get_background_removal_session,
    normalized_image,
    remove_image_background,
    transparent_png,
)
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import effective_permissions, require_permission

router = APIRouter(prefix="/thumbnail-settings", tags=["thumbnail-settings"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
ENTITY = "ThumbnailAISettings"
DEFAULTS = {"provider": "local", "model": "isnet-general-use", "monthly_limit": 100}


class SettingsPatch(BaseModel):
    provider: Literal["local", "removebg"]
    model: Literal["isnet-general-use", "u2netp"] = "isnet-general-use"
    api_key: SecretStr | None = None
    clear_key: bool = False
    monthly_limit: int = Field(default=100, ge=0, le=100000)


def settings_record(session, tenant_id, *, lock=False):
    query = select(TenantRecord).where(
        TenantRecord.tenant_id == tenant_id, TenantRecord.entity_type == ENTITY
    )
    return session.scalar(query.with_for_update() if lock else query)


def cipher():
    secret = get_settings().thumbnail_secret_key
    try:
        if not secret:
            raise ValueError()
        return Fernet(secret.get_secret_value().encode())
    except ValueError as error:
        raise PublicError(
            503,
            "SECRET_STORAGE_NOT_CONFIGURED",
            "Configure THUMBNAIL_SECRET_KEY no servidor para armazenar chaves de IA.",
        ) from error


def decrypt_key(data):
    try:
        encrypted = data.get("encrypted_key")
        if not encrypted:
            raise PublicError(422, "AI_KEY_REQUIRED", "Configure a chave do provedor de recorte.")
        return cipher().decrypt(encrypted.encode()).decode()
    except InvalidToken as error:
        raise PublicError(
            503, "AI_KEY_UNREADABLE", "Reconfigure a credencial de recorte."
        ) from error


def public_settings(data):
    month = datetime.now(UTC).strftime("%Y-%m")
    return {
        **{key: data.get(key, value) for key, value in DEFAULTS.items()},
        "key_configured": bool(data.get("encrypted_key")),
        "key_hint": "••••" if data.get("encrypted_key") else "",
        "external_attempts_this_month": data.get("attempts", 0)
        if data.get("month") == month
        else 0,
        "credit_balance": None,
    }


@router.get("")
def read_settings(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    record = settings_record(session, membership.tenant_id)
    return {
        **public_settings(record.data if record else {}),
        "can_manage": "permissions.manage" in effective_permissions(session, current),
    }


@router.patch("")
def write_settings(body: SettingsPatch, current: Authenticated, session: DbSession):
    require_permission(session, current, "permissions.manage")
    membership = require_membership(current)
    session.scalar(select(Tenant).where(Tenant.id == membership.tenant_id).with_for_update())
    record = settings_record(session, membership.tenant_id, lock=True)
    if record is None:
        record = TenantRecord(tenant_id=membership.tenant_id, entity_type=ENTITY, data={})
        session.add(record)
        session.flush()
    data = {
        **record.data,
        "provider": body.provider,
        "model": body.model,
        "monthly_limit": body.monthly_limit,
    }
    if body.clear_key:
        data.pop("encrypted_key", None)
    if body.api_key and body.api_key.get_secret_value().strip():
        data["encrypted_key"] = (
            cipher().encrypt(body.api_key.get_secret_value().strip().encode()).decode()
        )
    if body.provider == "removebg" and not data.get("encrypted_key"):
        raise PublicError(422, "AI_KEY_REQUIRED", "Informe a chave do remove.bg.")
    record.data = data
    add_audit(
        session,
        current,
        "thumbnail.settings_updated",
        ENTITY,
        str(record.id),
        {"provider": body.provider, "key_changed": bool(body.api_key or body.clear_key)},
    )
    session.commit()
    return {**public_settings(data), "can_manage": True}


@router.post("/test")
async def test_settings(current: Authenticated, session: DbSession):
    require_permission(session, current, "permissions.manage")
    membership = require_membership(current)
    record = settings_record(session, membership.tenant_id)
    data = {**DEFAULTS, **(record.data if record else {})}
    if data["provider"] == "local":
        try:
            await run_in_threadpool(get_background_removal_session, data["model"])
        except Exception as error:
            raise PublicError(
                503, "CUTOUT_UNAVAILABLE", "Modelo local indisponível no servidor."
            ) from error
        return {"ok": True, "message": "Modelo local carregado; nenhum crédito externo consumido."}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                "https://api.remove.bg/v1.0/account", headers={"X-Api-Key": decrypt_key(data)}
            )
        if response.status_code != 200:
            raise PublicError(
                422, "AI_CONNECTION_FAILED", "Credencial ou conexão com remove.bg inválida."
            )
    except httpx.HTTPError as error:
        raise PublicError(
            503, "AI_CONNECTION_FAILED", "Provedor de recorte indisponível."
        ) from error
    return {"ok": True, "message": "Conexão validada, sem enviar foto nem gerar recorte."}


async def configured_cutout(content: bytes, current: CurrentSession, session: Session) -> bytes:
    membership = require_membership(current)
    record = settings_record(session, membership.tenant_id, lock=True)
    data = {**DEFAULTS, **(record.data if record else {})}
    image = normalized_image(content)
    if image.getchannel("A").getextrema()[0] < 255:
        return transparent_png(image)
    digest = hashlib.sha256(
        content + str(data["provider"]).encode() + str(data["model"]).encode()
    ).hexdigest()
    cache = (
        get_settings().media_root / str(membership.tenant_id) / "thumbnail-cache" / f"{digest}.png"
    )
    if cache.is_file():
        return cache.read_bytes()
    if data["provider"] == "local":
        result = await run_in_threadpool(remove_image_background, content, data["model"])
    else:
        key = decrypt_key(data)
        month = datetime.now(UTC).strftime("%Y-%m")
        attempts = data.get("attempts", 0) if data.get("month") == month else 0
        if attempts >= data["monthly_limit"]:
            raise PublicError(429, "AI_USAGE_LIMIT", "Limite mensal de chamadas externas atingido.")
        # Reserve before the request; failures count as attempts, not as billed credits.
        record.data = {**data, "month": month, "attempts": attempts + 1}
        session.commit()
        try:
            async with httpx.AsyncClient(timeout=90) as client:
                response = await client.post(
                    "https://api.remove.bg/v1.0/removebg",
                    headers={"X-Api-Key": key},
                    files={"image_file": ("portrait.png", transparent_png(image), "image/png")},
                    data={"size": "auto", "format": "png", "type": "person"},
                )
            if response.status_code != 200:
                raise PublicError(
                    422,
                    "AI_CUTOUT_FAILED",
                    "Recorte externo recusado. Verifique chave, créditos e formato da foto.",
                )
            result = transparent_png(normalized_image(response.content))
        except httpx.HTTPError as error:
            raise PublicError(
                503,
                "AI_CUTOUT_FAILED",
                "Provedor de recorte indisponível. Tente novamente.",
                retryable=True,
            ) from error
    cache.parent.mkdir(parents=True, exist_ok=True)
    temporary = cache.with_suffix(f".{uuid4()}.part")
    try:
        temporary.write_bytes(result)
        temporary.replace(cache)
    finally:
        temporary.unlink(missing_ok=True)
    add_audit(
        session,
        current,
        "thumbnail.cutout_created",
        "Asset",
        digest,
        {"provider": data["provider"]},
    )
    session.commit()
    return result

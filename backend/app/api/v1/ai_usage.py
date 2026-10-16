"""Medição por tenant das rotas de IA instrumentadas. Nunca grava prompts ou segredos."""
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from time import perf_counter
from typing import Annotated
from uuid import UUID
import csv
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import Tenant, TenantRecord, User
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/ai/usage", tags=["ai-usage"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
EVENT = "AIUsageEvent"
POLICY = "AIUsagePolicy"
DEFAULT = {"daily_limit_usd": 0.0, "monthly_limit_usd": 0.0, "per_request_limit_usd": 0.0, "enabled": True, "prices": []}

class Price(BaseModel):
    provider: str = Field(min_length=1, max_length=40)
    model: str = Field(min_length=1, max_length=120)
    input_per_million_usd: float = Field(ge=0, le=100000)
    output_per_million_usd: float = Field(ge=0, le=100000)
    per_image_usd: float = Field(default=0, ge=0, le=100000)

class PolicyPatch(BaseModel):
    daily_limit_usd: float = Field(default=0, ge=0, le=100000)
    monthly_limit_usd: float = Field(default=0, ge=0, le=1000000)
    per_request_limit_usd: float = Field(default=0, ge=0, le=100000)
    enabled: bool = True
    prices: list[Price] = Field(default_factory=list, max_length=100)


def _scope(current):
    return require_membership(current).tenant_id


def _admin(session, current):
    require_permission(session, current, "permissions.manage")


def read_policy(session, tenant_id):
    row = session.scalar(select(TenantRecord).where(TenantRecord.tenant_id == tenant_id, TenantRecord.entity_type == POLICY))
    return {**DEFAULT, **(row.data if row else {})}


def cost_for(policy, provider, model, inp, out, images=0):
    for p in policy.get("prices", []):
        if p["provider"].lower() == provider.lower() and p["model"].lower() == model.lower():
            return round((inp * p["input_per_million_usd"] + out * p["output_per_million_usd"]) / 1000000 + images * p.get("per_image_usd", 0), 8), "configured_estimate"
    return None, "unpriced"


def _events(session, tenant_id, days=31):
    cutoff = datetime.now(UTC) - timedelta(days=days)
    return list(session.scalars(select(TenantRecord).where(TenantRecord.tenant_id == tenant_id, TenantRecord.entity_type == EVENT, TenantRecord.created_at >= cutoff).order_by(TenantRecord.created_at.desc()).limit(10000)))


def guard_budget(session, tenant_id, provider, model, max_tokens=0, image_count=0):
    """Pré-checagem conservadora; não garante limite rígido com requisições concorrentes."""
    policy = read_policy(session, tenant_id)
    if not policy["enabled"]:
        raise PublicError(403, "AI_DISABLED", "Chamadas de IA foram desativadas para esta empresa.")
    estimate, _ = cost_for(policy, provider, model, 0, max_tokens, image_count)
    if policy["per_request_limit_usd"] and estimate is None:
        raise PublicError(409, "AI_PRICE_REQUIRED", "Cadastre o preço do modelo antes de usar limite por requisição.")
    if estimate is not None and policy["per_request_limit_usd"] and estimate > policy["per_request_limit_usd"]:
        raise PublicError(429, "AI_REQUEST_BUDGET", "Estimativa da requisição excede o limite configurado.")
    if policy["daily_limit_usd"] or policy["monthly_limit_usd"]:
        rows = _events(session, tenant_id, 31)
        if any(row.data.get("cost_usd") is None for row in rows if row.data.get("status") == "ok"):
            raise PublicError(409, "AI_COST_INCOMPLETE", "Existem chamadas sem preço; cadastre preços para ativar o bloqueio confiável.")
        month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        day_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        daily = sum(row.data.get("cost_usd") or 0 for row in rows if row.created_at >= day_start)
        monthly = sum(row.data.get("cost_usd") or 0 for row in rows if row.created_at >= month_start)
        if policy["daily_limit_usd"] and daily >= policy["daily_limit_usd"]:
            raise PublicError(429, "AI_DAILY_LIMIT", "Limite diário de IA atingido.")
        if policy["monthly_limit_usd"] and monthly >= policy["monthly_limit_usd"]:
            raise PublicError(429, "AI_MONTHLY_LIMIT", "Limite mensal de IA atingido.")
    return policy


def record_usage(session, tenant_id, user_id, *, provider, model, feature, status="ok", latency_ms=0, input_tokens=0, output_tokens=0, images=0, error_code=None, connection_id=None, request_id=None, usage_known=True):
    policy = read_policy(session, tenant_id)
    cost, basis = cost_for(policy, provider, model, input_tokens, output_tokens, images) if usage_known else (None, "missing_provider_usage")
    row = TenantRecord(tenant_id=tenant_id, entity_type=EVENT, data={
        "user_id": str(user_id) if user_id else None,
        "provider": provider, "model": model, "feature": feature,
        "status": status, "latency_ms": round(latency_ms), "input_tokens": input_tokens,
        "output_tokens": output_tokens, "images": images, "cost_usd": cost,
        "cost_basis": basis, "error_code": error_code, "connection_id": connection_id,
        "request_id": request_id, "usage_known": usage_known,
    })
    session.add(row)
    session.commit()
    return row


def _authorized(current, session):
    _admin(session, current)
    return _scope(current)

@router.get("/policy")
def policy(current: Authenticated, session: DbSession):
    return read_policy(session, _authorized(current, session))

@router.put("/policy")
def update_policy(body: PolicyPatch, current: Authenticated, session: DbSession):
    tenant_id = _authorized(current, session)
    session.scalar(select(Tenant).where(Tenant.id == tenant_id).with_for_update())
    row = session.scalar(select(TenantRecord).where(TenantRecord.tenant_id == tenant_id, TenantRecord.entity_type == POLICY).with_for_update())
    if row is None:
        row = TenantRecord(tenant_id=tenant_id, entity_type=POLICY, data={})
        session.add(row)
    row.data = body.model_dump()
    session.commit()
    return read_policy(session, tenant_id)

@router.get("/report")
def report(current: Authenticated, session: DbSession, days: int = Query(default=30, ge=1, le=31)):
    tenant_id = _authorized(current, session)
    rows = _events(session, tenant_id, days)
    ids = {r.data.get("user_id") for r in rows if r.data.get("user_id")}
    users = {str(u.id): u.full_name or u.email for u in session.scalars(select(User).where(User.id.in_([UUID(i) for i in ids])))} if ids else {}
    totals = {"calls": len(rows), "ok": 0, "errors": 0, "priced_usd": 0.0, "unpriced_calls": 0, "input_tokens": 0, "output_tokens": 0, "images": 0}
    group = defaultdict(lambda: {"calls": 0, "errors": 0, "cost_usd": 0.0, "unpriced": 0, "input_tokens": 0, "output_tokens": 0})
    for row in rows:
        d = row.data
        if d.get("status") == "ok": totals["ok"] += 1
        else: totals["errors"] += 1
        totals["input_tokens"] += d.get("input_tokens") or 0
        totals["output_tokens"] += d.get("output_tokens") or 0
        totals["images"] += d.get("images") or 0
        if d.get("cost_usd") is None: totals["unpriced_calls"] += 1
        else: totals["priced_usd"] += d["cost_usd"]
        for name, key in (("models", f'{d.get("provider")}/{d.get("model")}'), ("features", d.get("feature") or "?"), ("users", users.get(d.get("user_id"), "Usuário desconhecido")), ("days", row.created_at.date().isoformat())):
            b = group[(name, key)]
            b["calls"] += 1
            b["errors"] += int(d.get("status") != "ok")
            b["cost_usd"] += d.get("cost_usd") or 0
            b["unpriced"] += int(d.get("cost_usd") is None)
            b["input_tokens"] += d.get("input_tokens") or 0
            b["output_tokens"] += d.get("output_tokens") or 0
    events = [{"id": str(r.id), "at": r.created_at.isoformat(), **r.data, "user": users.get(r.data.get("user_id"), "Não identificado")} for r in rows[:250]]
    groups = {name: sorted([{"name": key, **value} for (category,key),value in group.items() if category == name], key=lambda x: -x["calls"]) for name in ("models", "features", "users", "days")}
    from app.api.v1.ai import ai_settings_record, public_connections
    config = ai_settings_record(session, tenant_id)
    return {"totals": totals, "groups": groups, "events": events, "policy": read_policy(session, tenant_id), "connections": public_connections(config.data if config else {}, True), "coverage": {"tracked": ["ai/generation/image", "ai/generation/video-studio", "mcp/ai-tools.prompt", "mcp/ai-tools.video_studio", "ai/copilot/chat"], "other_modules": "Ainda não instrumentados. Totais parciais, não representam toda a conta do provedor."}, "basis": "Custos estimados pelas tabelas configuradas; não são faturas oficiais."}

@router.get("/export.csv")
def export_csv(current: Authenticated, session: DbSession, days: int = Query(default=30, ge=1, le=31)):
    tenant_id = _authorized(current, session)
    rows = _events(session, tenant_id, days)
    out = io.StringIO()
    cols = ["timestamp", "user_id", "provider", "model", "feature", "status", "latency_ms", "input_tokens", "output_tokens", "images", "cost_usd", "cost_basis", "error_code", "connection_id", "request_id"]
    w = csv.DictWriter(out, fieldnames=cols)
    w.writeheader()
    for row in rows:
        w.writerow({"timestamp": row.created_at.isoformat(), **{k: row.data.get(k) for k in cols if k != "timestamp"}})
    out.seek(0)
    return StreamingResponse(iter([out.getvalue()]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="mediamind-ai-usage.csv"'})

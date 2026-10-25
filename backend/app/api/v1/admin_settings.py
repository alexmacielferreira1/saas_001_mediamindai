from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.records import add_audit
from app.db.session import get_session
from app.models.identity import Tenant, TenantRecord
from app.schemas.admin_users import AdminSettingsPatch, AdminSettingsResponse
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]
SETTINGS_ENTITY = "OrganizationSettings"
SETTINGS_DEFAULTS = {
    "locale": "pt-BR",
    "timezone": "America/Sao_Paulo",
    "date_format": "DD/MM/YYYY",
}


def _settings_record(session: Session, tenant_id: UUID) -> TenantRecord | None:
    # Se já houver registros em dobro (criados antes da trava), vale sempre o mais antigo.
    return session.scalar(
        select(TenantRecord)
        .where(
            TenantRecord.tenant_id == tenant_id,
            TenantRecord.entity_type == SETTINGS_ENTITY,
        )
        .order_by(TenantRecord.created_at.asc(), TenantRecord.id.asc())
        .limit(1)
    )


def lock_tenant(session: Session, tenant_id: UUID) -> Tenant | None:
    """``SELECT ... FOR UPDATE`` na empresa: dois primeiros PATCHes simultâneos não criam
    duas configurações (o segundo espera e encontra o registro do primeiro)."""
    return session.scalar(select(Tenant).where(Tenant.id == tenant_id).with_for_update())


def _settings_response(tenant: Tenant, record: TenantRecord | None) -> AdminSettingsResponse:
    data = {**SETTINGS_DEFAULTS, **(record.data if record else {})}
    return AdminSettingsResponse(organization_name=tenant.name, **data)


@router.get("", response_model=AdminSettingsResponse)
def get_admin_settings(current: Authenticated, session: DbSession):
    selected = require_membership(current)
    tenant = session.get(Tenant, selected.tenant_id)
    return _settings_response(tenant, _settings_record(session, selected.tenant_id))


@router.patch("", response_model=AdminSettingsResponse)
def update_admin_settings(body: AdminSettingsPatch, current: Authenticated, session: DbSession):
    selected = require_membership(current)
    require_permission(session, current, "permissions.manage")
    tenant = lock_tenant(session, selected.tenant_id)
    submitted = body.model_dump(exclude_none=True)
    changes = dict(submitted)
    record = _settings_record(session, selected.tenant_id)
    previous = _settings_response(tenant, record).model_dump()
    if "organization_name" in changes:
        tenant.name = changes.pop("organization_name").strip()
    if record is None:
        record = TenantRecord(tenant_id=selected.tenant_id, entity_type=SETTINGS_ENTITY, data={})
        session.add(record)
        session.flush()
    record.data = {**SETTINGS_DEFAULTS, **record.data, **changes}
    current_values = _settings_response(tenant, record).model_dump()
    add_audit(
        session,
        current,
        "settings.updated",
        SETTINGS_ENTITY,
        str(record.id),
        {"fields": sorted(submitted)},
        # Configurações da empresa não guardam segredos; registra só os campos enviados.
        before={field: previous[field] for field in sorted(submitted)},
        after={field: current_values[field] for field in sorted(submitted)},
    )
    session.commit()
    return _settings_response(tenant, record)

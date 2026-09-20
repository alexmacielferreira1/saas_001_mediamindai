from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.auth import session_payload
from app.core.errors import PublicError
from app.db.session import get_session
from app.repositories.identity import get_active_membership, list_active_memberships
from app.schemas.auth import SessionResponse
from app.schemas.tenancy import TenantListResponse, TenantResponse, TenantSelection
from app.tenancy.context import CurrentSession, get_current_session

router = APIRouter(tags=["tenancy"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]


@router.get("/tenants", response_model=TenantListResponse)
def list_tenants(current: Authenticated, session: DbSession):
    rows = list_active_memberships(session, current.user.id)
    return TenantListResponse(
        tenants=[
            TenantResponse(id=membership.tenant_id, name=tenant.name, role=membership.role)
            for membership, tenant in rows
        ]
    )


@router.put("/auth/session/tenant", response_model=SessionResponse)
def select_tenant(body: TenantSelection, current: Authenticated, session: DbSession):
    if body.tenant_id is None:
        memberships = list_active_memberships(session, current.user.id)
        if not any(item.role in {"admin", "superadmin"} for item, _tenant in memberships):
            raise PublicError(403, "TENANT_ACCESS_DENIED", "Acesso global não autorizado.")
        current.auth_session.selected_tenant_id = None
        session.commit()
        return session_payload(session, current.auth_session)
    membership = get_active_membership(session, current.user.id, body.tenant_id)
    if membership is None:
        raise PublicError(403, "TENANT_ACCESS_DENIED", "Acesso à empresa não autorizado.")
    current.auth_session.selected_tenant_id = body.tenant_id
    session.commit()
    return session_payload(session, current.auth_session)

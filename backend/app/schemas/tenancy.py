from uuid import UUID

from pydantic import BaseModel


class TenantSelection(BaseModel):
    tenant_id: UUID | None


class TenantResponse(BaseModel):
    id: UUID
    name: str
    role: str


class TenantListResponse(BaseModel):
    tenants: list[TenantResponse]

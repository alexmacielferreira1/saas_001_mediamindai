from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AdminUserSummary(BaseModel):
    id: UUID
    membership_id: UUID
    full_name: str
    email: str
    tenant_role: str
    profile_id: UUID | None = None
    profile_name: str | None = None
    status: str
    last_access_at: datetime | None = None
    created_at: datetime


class AdminUserListResponse(BaseModel):
    items: list[AdminUserSummary]
    total: int
    page: int
    page_size: int


class AdminUserDetail(AdminUserSummary):
    extra_screens: list[str]
    restricted_screens: list[str]
    failed_login_attempts: int
    locked_until: datetime | None = None


class AdminUserStatusChange(BaseModel):
    reason: str = Field(min_length=3, max_length=300)

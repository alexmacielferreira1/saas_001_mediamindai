from datetime import datetime
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator


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


class AdminUserSessionsRevoked(BaseModel):
    revoked_sessions: int


class AdminSettingsResponse(BaseModel):
    organization_name: str
    locale: str
    timezone: str
    date_format: str


class AdminSettingsPatch(BaseModel):
    organization_name: str | None = Field(default=None, min_length=2, max_length=200)
    locale: str | None = Field(default=None, pattern=r"^[a-z]{2}-[A-Z]{2}$")
    timezone: str | None = Field(default=None, min_length=3, max_length=80)
    date_format: str | None = Field(default=None, pattern=r"^(DD/MM/YYYY|MM/DD/YYYY|YYYY-MM-DD)$")

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Fuso horário inválido.") from exc
        return value

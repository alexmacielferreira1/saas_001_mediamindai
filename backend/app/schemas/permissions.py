from uuid import UUID

from pydantic import BaseModel, Field


class PermissionGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=300)
    permission_codes: list[str] = Field(default_factory=list)


class PermissionGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=300)
    permission_codes: list[str] | None = None


class PermissionGroupResponse(BaseModel):
    id: UUID
    name: str
    description: str
    is_active: bool
    permission_codes: list[str]


class PermissionGroupListResponse(BaseModel):
    permission_groups: list[PermissionGroupResponse]


class MembershipPermissionGroupUpdate(BaseModel):
    permission_group_id: UUID | None


class MembershipPermissionGroupResponse(BaseModel):
    membership_id: UUID
    permission_group_id: UUID | None

from typing import Annotated
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
    reason: str | None = Field(default=None, max_length=300)


class PermissionGroupResponse(BaseModel):
    id: UUID
    name: str
    description: str
    is_active: bool
    permission_codes: list[str]


class PermissionGroupListResponse(BaseModel):
    permission_groups: list[PermissionGroupResponse]


# Motivo opcional das mudanças de acesso; vai para a auditoria (MM-006/MM-008).
AccessChangeReason = Annotated[str | None, Field(max_length=300)]


class MembershipPermissionGroupUpdate(BaseModel):
    permission_group_id: UUID | None
    reason: AccessChangeReason = None


class MembershipPermissionGroupResponse(BaseModel):
    membership_id: UUID
    permission_group_id: UUID | None


class MembershipResponse(BaseModel):
    id: UUID
    user_id: UUID
    email: str
    full_name: str
    role: str
    permission_group_id: UUID | None
    extra_screens: list[str]
    restricted_screens: list[str]


class MembershipListResponse(BaseModel):
    memberships: list[MembershipResponse]


class MembershipRoleUpdate(BaseModel):
    role: str = Field(min_length=1, max_length=80)
    reason: AccessChangeReason = None


class MembershipRoleResponse(BaseModel):
    membership_id: UUID
    role: str


class MembershipScreens(BaseModel):
    extra_screens: list[str] = Field(default_factory=list)
    restricted_screens: list[str] = Field(default_factory=list)


class MembershipScreensUpdate(MembershipScreens):
    reason: AccessChangeReason = None


class MembershipScreensResponse(MembershipScreens):
    membership_id: UUID

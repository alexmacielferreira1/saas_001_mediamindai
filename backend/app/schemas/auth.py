from uuid import UUID

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str


class MembershipResponse(BaseModel):
    tenant_id: UUID
    tenant_name: str
    role: str


class SessionResponse(BaseModel):
    user: UserResponse
    memberships: list[MembershipResponse]
    selected_tenant_id: UUID | None

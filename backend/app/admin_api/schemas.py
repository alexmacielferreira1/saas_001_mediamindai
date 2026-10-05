from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class HubServiceIdentity(BaseModel):
    service: str
    audience: str
    scopes: frozenset[str]


class HubManifestEndpoints(BaseModel):
    health: str
    readiness: str
    version: str
    commands: str


class HubManifest(BaseModel):
    product_id: str
    display_name: str
    product_version: str
    admin_api_version: str
    capabilities: list[str]
    endpoints: HubManifestEndpoints


class HubObservation(BaseModel):
    status: str
    source: str
    environment: str
    observed_at: datetime


class HubReadiness(HubObservation):
    checks: dict[str, str]


class HubVersion(BaseModel):
    product_id: str
    product_version: str
    admin_api_version: str
    environment: str
    observed_at: datetime


class HubCommandCreate(BaseModel):
    action: str
    dry_run: bool = True
    parameters: dict[str, Any] = Field(default_factory=dict)


class HubCommandResponse(BaseModel):
    id: UUID
    action: str
    dry_run: bool
    status: str
    result: dict[str, Any]
    correlation_id: str
    created_at: datetime
    completed_at: datetime | None

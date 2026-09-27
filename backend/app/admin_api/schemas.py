from datetime import datetime

from pydantic import BaseModel


class HubServiceIdentity(BaseModel):
    service: str
    audience: str
    scopes: frozenset[str]


class HubManifestEndpoints(BaseModel):
    health: str
    readiness: str
    version: str


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

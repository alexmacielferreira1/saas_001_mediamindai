from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.admin_api.auth import require_hub_service
from app.admin_api.schemas import (
    HubManifest,
    HubManifestEndpoints,
    HubObservation,
    HubReadiness,
    HubServiceIdentity,
    HubVersion,
)
from app.core.config import get_settings
from app.core.errors import PublicError
from app.db.session import database_available

router = APIRouter(tags=["hub-admin"])
AuthenticatedHubService = Annotated[HubServiceIdentity, Depends(require_hub_service)]


def observed_now() -> datetime:
    return datetime.now(UTC)


@router.get("/.well-known/hub/manifest", response_model=HubManifest)
def manifest() -> HubManifest:
    settings = get_settings()
    return HubManifest(
        product_id=settings.hub_product_id,
        display_name="MediaMind AI",
        product_version=settings.version,
        admin_api_version="v1",
        capabilities=["observe.health", "observe.readiness", "observe.version"],
        endpoints=HubManifestEndpoints(
            health="/api/hub/v1/health",
            readiness="/api/hub/v1/readiness",
            version="/api/hub/v1/version",
        ),
    )


@router.get("/api/hub/v1/health", response_model=HubObservation)
def hub_health(_: AuthenticatedHubService) -> HubObservation:
    settings = get_settings()
    return HubObservation(
        status="healthy",
        source=settings.hub_product_id,
        environment=settings.environment,
        observed_at=observed_now(),
    )


@router.get("/api/hub/v1/readiness", response_model=HubReadiness)
def hub_readiness(request: Request, _: AuthenticatedHubService) -> HubReadiness:
    settings = get_settings()
    if not database_available():
        raise PublicError(
            503,
            "HUB_DATABASE_UNAVAILABLE",
            "Banco de dados indisponível para a integração do HUB.",
            retryable=True,
        )
    return HubReadiness(
        status="ready",
        source=settings.hub_product_id,
        environment=settings.environment,
        observed_at=observed_now(),
        checks={"api": "ready", "database": "ready"},
    )


@router.get("/api/hub/v1/version", response_model=HubVersion)
def hub_version(_: AuthenticatedHubService) -> HubVersion:
    settings = get_settings()
    return HubVersion(
        product_id=settings.hub_product_id,
        product_version=settings.version,
        admin_api_version="v1",
        environment=settings.environment,
        observed_at=observed_now(),
    )

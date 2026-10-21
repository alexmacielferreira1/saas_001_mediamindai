from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.admin_api.auth import require_hub_command_service, require_hub_service
from app.admin_api.commands import complete_now, execute_dry_run
from app.admin_api.schemas import (
    HubCommandCreate,
    HubCommandResponse,
    HubManifest,
    HubManifestEndpoints,
    HubObservation,
    HubReadiness,
    HubServiceIdentity,
    HubVersion,
)
from app.core.config import get_settings
from app.core.errors import PublicError
from app.db.session import database_available, get_session
from app.models.hub_command import HubCommand

router = APIRouter(tags=["hub-admin"])
AuthenticatedHubService = Annotated[HubServiceIdentity, Depends(require_hub_service)]
CommandHubService = Annotated[HubServiceIdentity, Depends(require_hub_command_service)]
DbSession = Annotated[Session, Depends(get_session)]


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
        capabilities=[
            "observe.health",
            "observe.readiness",
            "observe.version",
            "command.system.describe.dry-run",
            "command.media.count.dry-run",
        ],
        endpoints=HubManifestEndpoints(
            health="/api/hub/v1/health",
            readiness="/api/hub/v1/readiness",
            version="/api/hub/v1/version",
            commands="/api/hub/v1/commands",
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


def serialize_command(command: HubCommand) -> HubCommandResponse:
    created_at = command.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=UTC)
    completed_at = command.completed_at
    if completed_at is not None and completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=UTC)
    return HubCommandResponse(
        id=command.id,
        action=command.action,
        dry_run=command.dry_run,
        status=command.status,
        result=command.result,
        correlation_id=command.correlation_id,
        created_at=created_at,
        completed_at=completed_at,
    )


@router.post("/api/hub/v1/commands", response_model=HubCommandResponse)
def create_command(
    body: HubCommandCreate,
    request: Request,
    response: Response,
    identity: CommandHubService,
    session: DbSession,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=200)],
) -> HubCommandResponse:
    existing = find_command(session, identity.service, idempotency_key)
    if existing is not None:
        return replay_command(existing, body, response)

    if not body.dry_run:
        raise PublicError(
            409,
            "HUB_DRY_RUN_REQUIRED",
            "Somente simulações de leitura estão liberadas nesta versão.",
        )
    result = execute_dry_run(session, body.action)
    completed_at = complete_now()
    command = HubCommand(
        source_service=identity.service,
        idempotency_key=idempotency_key,
        action=body.action,
        dry_run=True,
        parameters=body.parameters,
        status="succeeded",
        result=result,
        correlation_id=request.state.correlation_id,
        completed_at=completed_at,
        updated_at=completed_at,
    )
    session.add(command)
    try:
        session.commit()
    except IntegrityError:
        # Concurrent request with the same key won the unique constraint: answer with
        # the command it recorded (same contract as a replay), never a 500.
        session.rollback()
        existing = find_command(session, identity.service, idempotency_key)
        if existing is None:
            raise
        return replay_command(existing, body, response)
    response.status_code = 202
    return serialize_command(command)


def find_command(session: Session, service: str, idempotency_key: str) -> HubCommand | None:
    return session.scalar(
        select(HubCommand).where(
            HubCommand.source_service == service,
            HubCommand.idempotency_key == idempotency_key,
        )
    )


def replay_command(
    existing: HubCommand, body: HubCommandCreate, response: Response
) -> HubCommandResponse:
    if (
        existing.action != body.action
        or existing.dry_run != body.dry_run
        or existing.parameters != body.parameters
    ):
        raise PublicError(
            409,
            "HUB_IDEMPOTENCY_CONFLICT",
            "A chave de repetição já foi usada por outro comando.",
        )
    response.status_code = 200
    return serialize_command(existing)


@router.get("/api/hub/v1/commands/{command_id}", response_model=HubCommandResponse)
def get_command(
    command_id: UUID,
    identity: CommandHubService,
    session: DbSession,
) -> HubCommandResponse:
    command = session.scalar(
        select(HubCommand).where(
            HubCommand.id == command_id,
            HubCommand.source_service == identity.service,
        )
    )
    if command is None:
        raise PublicError(404, "HUB_COMMAND_NOT_FOUND", "Comando não encontrado.")
    return serialize_command(command)

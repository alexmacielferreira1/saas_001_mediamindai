from datetime import UTC, datetime
from hmac import compare_digest
from typing import Annotated

from fastapi import Header, HTTPException, Request, status

from app.admin_api.schemas import HubServiceIdentity
from app.core.config import get_settings


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        headers={"WWW-Authenticate": "Bearer"},
    )


def authenticate_hub_service(
    *,
    authorization: str | None,
    audience: str | None,
    scopes_header: str | None,
    service: str | None,
    required_scope: str,
) -> HubServiceIdentity:
    settings = get_settings()
    configured_token = settings.hub_admin_token
    configured_value = configured_token.get_secret_value().strip() if configured_token else ""
    scheme, _, supplied_token = (authorization or "").partition(" ")
    supplied_token = supplied_token.strip()
    # compare_digest runs in constant time for equal-length inputs; compare bytes so
    # non-ASCII input cannot raise and leak timing through an exception path.
    if (
        not configured_value
        or scheme.lower() != "bearer"
        or not supplied_token
        or not compare_digest(supplied_token.encode(), configured_value.encode())
    ):
        raise _unauthorized()

    expires_at = settings.hub_admin_token_expires_at
    if expires_at is not None and datetime.now(UTC) >= expires_at:
        raise _unauthorized()

    if audience != settings.hub_admin_audience:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    # Scopes are bound to the token on the server. The optional X-Hub-Scopes header
    # can only narrow them (least privilege); it can never grant a scope.
    granted = settings.hub_admin_scope_set
    if scopes_header is not None and scopes_header.strip():
        granted = granted & frozenset(scopes_header.split())
    if required_scope not in granted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    return HubServiceIdentity(
        service=service or settings.hub_admin_audience,
        audience=audience,
        scopes=granted,
    )


def require_hub_service(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    x_hub_audience: Annotated[str | None, Header()] = None,
    x_hub_scopes: Annotated[str | None, Header()] = None,
    x_hub_service: Annotated[str | None, Header()] = None,
) -> HubServiceIdentity:
    return authenticate_hub_service(
        authorization=authorization,
        audience=x_hub_audience,
        scopes_header=x_hub_scopes,
        service=x_hub_service,
        required_scope="hub:observe",
    )


def require_hub_command_service(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    x_hub_audience: Annotated[str | None, Header()] = None,
    x_hub_scopes: Annotated[str | None, Header()] = None,
    x_hub_service: Annotated[str | None, Header()] = None,
) -> HubServiceIdentity:
    return authenticate_hub_service(
        authorization=authorization,
        audience=x_hub_audience,
        scopes_header=x_hub_scopes,
        service=x_hub_service,
        required_scope="hub:command",
    )

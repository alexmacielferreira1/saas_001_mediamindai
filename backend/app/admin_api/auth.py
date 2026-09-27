from hmac import compare_digest
from typing import Annotated

from fastapi import Header, HTTPException, Request, status

from app.admin_api.schemas import HubServiceIdentity
from app.core.config import get_settings


def require_hub_service(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    x_hub_audience: Annotated[str | None, Header()] = None,
    x_hub_scopes: Annotated[str | None, Header()] = None,
    x_hub_service: Annotated[str | None, Header()] = None,
) -> HubServiceIdentity:
    settings = get_settings()
    configured_token = settings.hub_admin_token
    scheme, _, supplied_token = (authorization or "").partition(" ")
    if (
        configured_token is None
        or scheme.lower() != "bearer"
        or not supplied_token
        or not compare_digest(supplied_token, configured_token.get_secret_value())
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers={"WWW-Authenticate": "Bearer"},
        )

    if x_hub_audience != settings.hub_admin_audience:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    scopes = frozenset((x_hub_scopes or "").split())
    if "hub:observe" not in scopes:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    return HubServiceIdentity(
        service=x_hub_service or settings.hub_admin_audience,
        audience=x_hub_audience,
        scopes=scopes,
    )

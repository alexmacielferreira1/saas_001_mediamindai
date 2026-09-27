from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import PublicError
from app.models.identity import TenantRecord

ALLOWED_DRY_RUN_ACTIONS = frozenset({"system.describe", "media.count"})


def execute_dry_run(session: Session, action: str) -> dict[str, Any]:
    if action not in ALLOWED_DRY_RUN_ACTIONS:
        raise PublicError(422, "HUB_ACTION_NOT_ALLOWED", "Comando não permitido pelo MediaMind.")
    if action == "system.describe":
        settings = get_settings()
        return {
            "product_id": settings.hub_product_id,
            "environment": settings.environment,
            "mode": "read_only",
        }
    count = session.scalar(
        select(func.count()).select_from(TenantRecord).where(TenantRecord.entity_type == "Asset")
    )
    return {"assets": count or 0}


def complete_now() -> datetime:
    return datetime.now(UTC)

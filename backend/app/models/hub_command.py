from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class HubCommand(Base):
    __tablename__ = "hub_commands"
    __table_args__ = (
        UniqueConstraint(
            "source_service",
            "idempotency_key",
            name="uq_hub_command_source_idempotency",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    source_service: Mapped[str] = mapped_column(String(120), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(200))
    action: Mapped[str] = mapped_column(String(120), index=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True)
    parameters: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(40), default="accepted", index=True)
    result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    correlation_id: Mapped[str] = mapped_column(String(128), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

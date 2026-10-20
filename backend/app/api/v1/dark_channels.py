from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import TenantRecord
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/dark-channels", tags=["dark-channels"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]


class ChannelCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    niche: str = Field(min_length=1, max_length=120)
    audience: str = Field(default="", max_length=240)
    language: str = Field(default="pt-BR", min_length=2, max_length=24)
    format: Literal["long", "shorts", "both"] = "long"
    publishing_mode: Literal["manual", "automatic"] = "manual"

    @field_validator("name", "niche", "language")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("O campo é obrigatório.")
        return value


class ChannelPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    niche: str | None = Field(default=None, min_length=1, max_length=120)
    audience: str | None = Field(default=None, max_length=240)
    language: str | None = Field(default=None, min_length=2, max_length=24)
    format: Literal["long", "shorts", "both"] | None = None
    publishing_mode: Literal["manual", "automatic"] | None = None
    archived: bool | None = None
    topic_folders: list[str] | None = Field(default=None, max_length=100)
    materials: list[dict[str, str]] | None = Field(default=None, max_length=100)

    @field_validator("name", "niche", "language")
    @classmethod
    def trim_nonempty_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("O campo não pode ficar vazio.")
        return value

    @field_validator("topic_folders")
    @classmethod
    def normalize_topic_folders(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return values
        normalized = [value.strip() for value in values]
        if any(not value or len(value) > 120 for value in normalized):
            raise ValueError("Os nomes das pastas devem ter entre 1 e 120 caracteres.")
        return list(dict.fromkeys(normalized))

    @field_validator("materials")
    @classmethod
    def validate_channel_materials(cls, values: list[dict[str, str]] | None):
        if values is None:
            return values
        return [DarkMaterial.model_validate(value).model_dump() for value in values]


class ScriptCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: str = Field(min_length=1, max_length=240)
    title: str = Field(default="", max_length=200)

    @field_validator("topic")
    @classmethod
    def trim_topic(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Informe o tema do roteiro.")
        return value


class DarkMaterial(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=160)
    reference: str = Field(min_length=1, max_length=2048)
    kind: Literal["link", "video", "audio", "image", "document"] = "link"

    @field_validator("title", "reference")
    @classmethod
    def trim_material_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("O material precisa de nome e referência.")
        return value

    @field_validator("reference")
    @classmethod
    def validate_material_reference(cls, value: str) -> str:
        if not value.startswith(("https://", "http://")):
            raise ValueError("A referência deve usar HTTP ou HTTPS.")
        return value


class DarkCut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1, max_length=120)
    start_seconds: float = Field(ge=0, le=86_400)
    end_seconds: float = Field(gt=0, le=86_400)

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_seconds <= self.start_seconds:
            raise ValueError("O fim do corte precisa ser posterior ao início.")
        return self


class DarkMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    views: int = Field(default=0, ge=0, le=2_147_483_647)
    likes: int = Field(default=0, ge=0, le=2_147_483_647)
    comments: int = Field(default=0, ge=0, le=2_147_483_647)


class DarkWorkflow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    folder_name: str = Field(default="", max_length=120)
    final_title: str = Field(default="", max_length=200)
    materials: list[DarkMaterial] = Field(default_factory=list, max_length=100)
    thumbnail_title: str = Field(default="", max_length=160)
    thumbnail_reference: str = Field(default="", max_length=2048)
    video_format: Literal["16:9", "9:16", "1:1"] = "16:9"
    target_channels: list[Literal["youtube", "instagram", "tiktok", "facebook"]] = Field(
        default_factory=list, max_length=4
    )
    description: str = Field(default="", max_length=5000)
    tags: list[str] = Field(default_factory=list, max_length=30)
    cuts: list[DarkCut] = Field(default_factory=list, max_length=50)
    scheduled_at: str = Field(default="", max_length=40)
    publication_url: str = Field(default="", max_length=2048)
    published_at: str = Field(default="", max_length=40)
    metrics: DarkMetrics = Field(default_factory=DarkMetrics)

    @field_validator(
        "folder_name",
        "final_title",
        "thumbnail_title",
        "thumbnail_reference",
        "description",
        "scheduled_at",
        "publication_url",
        "published_at",
    )
    @classmethod
    def trim_workflow_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("thumbnail_reference", "publication_url")
    @classmethod
    def validate_optional_urls(cls, value: str) -> str:
        if value and not value.startswith(("https://", "http://")):
            raise ValueError("A referência deve usar HTTP ou HTTPS.")
        return value

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, values: list[str]) -> list[str]:
        normalized = [value.strip()[:80] for value in values if value.strip()]
        return list(dict.fromkeys(normalized))

    @field_validator("target_channels")
    @classmethod
    def normalize_target_channels(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(values))

    @field_validator("scheduled_at", "published_at")
    @classmethod
    def validate_timestamps(cls, value: str) -> str:
        if not value:
            return value
        try:
            timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("Informe uma data e hora ISO 8601 válida.") from exc
        if timestamp.tzinfo is None:
            raise ValueError("A data e hora precisa incluir o fuso horário.")
        return value


class ScriptPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: str | None = Field(default=None, min_length=1, max_length=240)
    title: str | None = Field(default=None, max_length=200)
    script: str | None = Field(default=None, max_length=200_000)
    status: Literal["draft", "in_review", "approved", "archived"] | None = None
    validation_status: Literal["pending", "in_progress", "passed", "failed"] | None = None
    workflow: DarkWorkflow | None = None

    @field_validator("topic")
    @classmethod
    def trim_nonempty_topic(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("O tema não pode ficar vazio.")
        return value


def _find_channel(session: Session, tenant_id: UUID, channel_id: UUID) -> TenantRecord:
    record = session.scalar(
        select(TenantRecord).where(
            TenantRecord.id == channel_id,
            TenantRecord.tenant_id == tenant_id,
            TenantRecord.entity_type == "CanalDark",
        )
    )
    if record is None:
        raise PublicError(404, "DARK_CHANNEL_NOT_FOUND", "Canal não encontrado.")
    return record


def _find_script(
    session: Session, tenant_id: UUID, channel_id: UUID, script_id: UUID
) -> TenantRecord:
    record = session.scalar(
        select(TenantRecord).where(
            TenantRecord.id == script_id,
            TenantRecord.tenant_id == tenant_id,
            TenantRecord.entity_type == "RoteiroCanalDark",
        )
    )
    if record is None or record.data.get("channel_id") != str(channel_id):
        raise PublicError(404, "DARK_SCRIPT_NOT_FOUND", "Roteiro não encontrado neste canal.")
    return record


def _serialize(record: TenantRecord) -> dict:
    return {
        **record.data,
        "id": str(record.id),
        "created_date": record.created_at.isoformat(),
        "updated_date": record.updated_at.isoformat(),
    }


def _audit(
    session: Session,
    current: CurrentSession,
    membership_tenant_id: UUID,
    action: str,
    entity_type: str,
    record_id: UUID,
) -> None:
    session.add(
        TenantRecord(
            tenant_id=membership_tenant_id,
            entity_type="LogAuditoria",
            data={
                "action": action,
                "entity_type": entity_type,
                "entity_id": str(record_id),
                "user_id": str(current.user.id),
                "details": {},
            },
        )
    )


@router.get("")
def list_channels(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    records = session.scalars(
        select(TenantRecord)
        .where(
            TenantRecord.tenant_id == membership.tenant_id,
            TenantRecord.entity_type == "CanalDark",
        )
        .order_by(TenantRecord.updated_at.desc())
    )
    return {"channels": [_serialize(item) for item in records]}


@router.post("", status_code=201)
def create_channel(body: ChannelCreate, current: Authenticated, session: DbSession):
    require_permission(session, current, "production.write")
    membership = require_membership(current)
    record = TenantRecord(
        tenant_id=membership.tenant_id,
        entity_type="CanalDark",
        data={**body.model_dump(), "archived": False, "topic_folders": [], "materials": []},
    )
    session.add(record)
    session.flush()
    _audit(session, current, membership.tenant_id, "dark_channel.created", "CanalDark", record.id)
    session.commit()
    return _serialize(record)


@router.patch("/{channel_id}")
def update_channel(
    channel_id: UUID, body: ChannelPatch, current: Authenticated, session: DbSession
):
    membership = require_membership(current)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise PublicError(422, "EMPTY_UPDATE", "Informe ao menos uma alteração.")
    require_permission(
        session,
        current,
        "publishing.write" if "publishing_mode" in changes else "production.write",
    )
    record = _find_channel(session, membership.tenant_id, channel_id)
    if "materials" in changes:
        has_script = any(
            item.data.get("channel_id") == str(channel_id)
            for item in session.scalars(
                select(TenantRecord).where(
                    TenantRecord.tenant_id == membership.tenant_id,
                    TenantRecord.entity_type == "RoteiroCanalDark",
                )
            )
        )
        if not has_script:
            raise PublicError(
                409,
                "DARK_SCRIPT_REQUIRED_FOR_MATERIALS",
                "Crie o primeiro roteiro do canal antes de cadastrar materiais.",
            )
    record.data = {**record.data, **changes}
    _audit(session, current, membership.tenant_id, "dark_channel.updated", "CanalDark", record.id)
    session.commit()
    return _serialize(record)


@router.get("/{channel_id}/scripts")
def list_scripts(channel_id: UUID, current: Authenticated, session: DbSession):
    membership = require_membership(current)
    _find_channel(session, membership.tenant_id, channel_id)
    records = session.scalars(
        select(TenantRecord)
        .where(
            TenantRecord.tenant_id == membership.tenant_id,
            TenantRecord.entity_type == "RoteiroCanalDark",
        )
        .order_by(TenantRecord.updated_at.desc())
    )
    return {
        "scripts": [
            _serialize(item) for item in records if item.data.get("channel_id") == str(channel_id)
        ]
    }


@router.post("/{channel_id}/scripts", status_code=201)
def create_script(channel_id: UUID, body: ScriptCreate, current: Authenticated, session: DbSession):
    require_permission(session, current, "production.write")
    membership = require_membership(current)
    _find_channel(session, membership.tenant_id, channel_id)
    record = TenantRecord(
        tenant_id=membership.tenant_id,
        entity_type="RoteiroCanalDark",
        data={
            **body.model_dump(),
            "channel_id": str(channel_id),
            "script": "",
            "status": "draft",
            "validation_status": "pending",
            "publication_status": "not_ready",
            "video_status": "not_started",
            "workflow": DarkWorkflow().model_dump(),
        },
    )
    session.add(record)
    session.flush()
    _audit(
        session,
        current,
        membership.tenant_id,
        "dark_script.created",
        "RoteiroCanalDark",
        record.id,
    )
    session.commit()
    return _serialize(record)


@router.patch("/{channel_id}/scripts/{script_id}")
def update_script(
    channel_id: UUID,
    script_id: UUID,
    body: ScriptPatch,
    current: Authenticated,
    session: DbSession,
):
    membership = require_membership(current)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise PublicError(422, "EMPTY_UPDATE", "Informe ao menos uma alteração.")
    requires_review = "status" in changes or "validation_status" in changes
    workflow = changes.get("workflow")
    requires_publishing = bool(
        workflow
        and {"scheduled_at", "target_channels", "publication_url", "published_at"}.intersection(
            workflow
        )
    )
    permission = (
        "review.write"
        if requires_review
        else "publishing.write"
        if requires_publishing
        else "production.write"
    )
    require_permission(session, current, permission)
    channel = _find_channel(session, membership.tenant_id, channel_id)
    record = _find_script(session, membership.tenant_id, channel_id, script_id)
    workflow_patch = changes.get("workflow") or {}
    folder_name = workflow_patch.get("folder_name")
    if folder_name and folder_name not in channel.data.get("topic_folders", []):
        raise PublicError(422, "DARK_FOLDER_NOT_FOUND", "A pasta precisa pertencer a este canal.")
    if workflow:
        existing_workflow = record.data.get("workflow", {})
        merged_workflow = {**existing_workflow, **workflow}
        if "metrics" in workflow:
            merged_workflow["metrics"] = {
                **existing_workflow.get("metrics", {}),
                **workflow["metrics"],
            }
        changes["workflow"] = merged_workflow
    record.data = {**record.data, **changes}
    if changes.get("status") == "approved":
        record.data["validation_status"] = "passed"
    _audit(
        session,
        current,
        membership.tenant_id,
        "dark_script.updated",
        "RoteiroCanalDark",
        record.id,
    )
    session.commit()
    return _serialize(record)

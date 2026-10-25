import re
import unicodedata
from copy import deepcopy
from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import PublicError
from app.db.session import get_session
from app.models.identity import TenantRecord
from app.services.dark_structure_templates import (
    DEFAULT_TEMPLATE_ID,
    STRUCTURE_SCHEMA,
    TEMPLATES,
    get_template_package,
    list_templates,
)
from app.tenancy.context import CurrentSession, get_current_session, require_membership
from app.tenancy.permissions import require_permission

router = APIRouter(prefix="/dark-channels", tags=["dark-channels"])
DbSession = Annotated[Session, Depends(get_session)]
Authenticated = Annotated[CurrentSession, Depends(get_current_session)]

STRUCTURE_ENTITY = "EstruturaCanaisDark"
LifecycleStatus = Literal[
    "ideia",
    "planejado",
    "implementacao",
    "lancamento",
    "ativo",
    "pausado",
    "em_espera",
    "arquivado",
]
Platform = Literal["youtube", "instagram", "tiktok", "facebook"]
EXTERNAL_ID_PATTERN = r"^[a-z0-9][a-z0-9-]{0,79}$"
DECISION_ID_PATTERN = r"^[a-z0-9][a-z0-9-]{0,59}$"
# Valores usados quando um canal antigo não tem os campos de estrutura.
CHANNEL_DEFAULTS = {
    "audience": "",
    "language": "pt-BR",
    "format": "long",
    "external_id": None,
    "niche_code": "",
    "subniche": "",
    "lifecycle_status": "ativo",
    "launch_wave": None,
    "weekly_target": 0,
    "regional_frame": "",
    "target_platforms": [],
    "alt_names": [],
    "notes": "",
    "topic_folders": [],
    "materials": [],
    "archived": False,
}
# Campos do canal que entram no pacote de estrutura (importação/exportação).
PACKAGE_CHANNEL_FIELDS = (
    "external_id",
    "name",
    "niche",
    "niche_code",
    "subniche",
    "language",
    "audience",
    "format",
    "topic_folders",
    "target_platforms",
    "launch_wave",
    "lifecycle_status",
    "weekly_target",
    "regional_frame",
    "alt_names",
    "notes",
)
FOLDERS_MESSAGE = "Os nomes das pastas devem ter entre 1 e 120 caracteres."
ALT_NAMES_MESSAGE = "Os nomes alternativos devem ter entre 1 e 120 caracteres."


def _clean_required(value: str | None, message: str) -> str | None:
    if value is None:
        return value
    value = value.strip()
    if not value:
        raise ValueError(message)
    return value


def _clean_names(values: list[str] | None, max_length: int, message: str) -> list[str] | None:
    if values is None:
        return values
    normalized = [value.strip() for value in values]
    if any(not value or len(value) > max_length for value in normalized):
        raise ValueError(message)
    return list(dict.fromkeys(normalized))


def _strip_optional(value: str | None) -> str | None:
    return None if value is None else value.strip()


def _validate_aware_timestamp(value: str) -> str:
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Informe uma data e hora ISO 8601 válida.") from exc
    if timestamp.tzinfo is None:
        raise ValueError("A data e hora precisa incluir o fuso horário.")
    return value


def _dedupe(values: list | None) -> list | None:
    return None if values is None else list(dict.fromkeys(values))


class ChannelStructureFields(BaseModel):
    """Campos de canal comuns ao cadastro manual e à importação de estrutura."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    niche: str = Field(min_length=1, max_length=120)
    audience: str = Field(default="", max_length=240)
    language: str = Field(default="pt-BR", min_length=2, max_length=24)
    format: Literal["long", "shorts", "both"] = "long"
    external_id: str | None = Field(default=None, max_length=80, pattern=EXTERNAL_ID_PATTERN)
    niche_code: str = Field(default="", max_length=12)
    subniche: str = Field(default="", max_length=80)
    lifecycle_status: LifecycleStatus = "ativo"
    launch_wave: int | None = Field(default=None, ge=1, le=99)
    weekly_target: int = Field(default=0, ge=0, le=100)
    regional_frame: str = Field(default="", max_length=40)
    target_platforms: list[Platform] = Field(default_factory=list, max_length=4)
    alt_names: list[str] = Field(default_factory=list, max_length=10)
    notes: str = Field(default="", max_length=2000)
    topic_folders: list[str] = Field(default_factory=list, max_length=100)

    @field_validator("name", "niche", "language")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        return _clean_required(value, "O campo é obrigatório.")

    @field_validator("niche_code", "subniche", "regional_frame", "notes")
    @classmethod
    def trim_optional_text(cls, value: str) -> str:
        return _strip_optional(value)

    @field_validator("target_platforms")
    @classmethod
    def dedupe_platforms(cls, values: list[str]) -> list[str]:
        return _dedupe(values)

    @field_validator("alt_names")
    @classmethod
    def normalize_alt_names(cls, values: list[str]) -> list[str]:
        return _clean_names(values, 120, ALT_NAMES_MESSAGE)

    @field_validator("topic_folders")
    @classmethod
    def normalize_topic_folders(cls, values: list[str]) -> list[str]:
        return _clean_names(values, 120, FOLDERS_MESSAGE)


class ChannelCreate(ChannelStructureFields):
    publishing_mode: Literal["manual", "automatic"] = "manual"


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
    external_id: str | None = Field(default=None, max_length=80, pattern=EXTERNAL_ID_PATTERN)
    niche_code: str | None = Field(default=None, max_length=12)
    subniche: str | None = Field(default=None, max_length=80)
    lifecycle_status: LifecycleStatus | None = None
    launch_wave: int | None = Field(default=None, ge=1, le=99)
    weekly_target: int | None = Field(default=None, ge=0, le=100)
    regional_frame: str | None = Field(default=None, max_length=40)
    target_platforms: list[Platform] | None = Field(default=None, max_length=4)
    alt_names: list[str] | None = Field(default=None, max_length=10)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("name", "niche", "language")
    @classmethod
    def trim_nonempty_text(cls, value: str | None) -> str | None:
        return _clean_required(value, "O campo não pode ficar vazio.")

    @field_validator("niche_code", "subniche", "regional_frame", "notes")
    @classmethod
    def trim_optional_text(cls, value: str | None) -> str | None:
        return _strip_optional(value)

    @field_validator("target_platforms")
    @classmethod
    def dedupe_platforms(cls, values: list[str] | None) -> list[str] | None:
        return _dedupe(values)

    @field_validator("alt_names")
    @classmethod
    def normalize_alt_names(cls, values: list[str] | None) -> list[str] | None:
        return _clean_names(values, 120, ALT_NAMES_MESSAGE)

    @field_validator("topic_folders")
    @classmethod
    def normalize_topic_folders(cls, values: list[str] | None) -> list[str] | None:
        return _clean_names(values, 120, FOLDERS_MESSAGE)

    @field_validator("materials")
    @classmethod
    def validate_channel_materials(cls, values: list[dict[str, str]] | None):
        if values is None:
            return values
        return [DarkMaterial.model_validate(value).model_dump() for value in values]


class StructureLanguage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=2, max_length=24)
    name: str = Field(min_length=1, max_length=80)
    regional_frame: str = Field(default="", max_length=40)
    notes: str = Field(default="", max_length=500)
    launch_wave: int | None = Field(default=None, ge=1, le=99)
    enabled: bool = True

    @field_validator("code", "name")
    @classmethod
    def trim_required(cls, value: str) -> str:
        return _clean_required(value, "O campo é obrigatório.")

    @field_validator("regional_frame", "notes")
    @classmethod
    def trim_optional(cls, value: str) -> str:
        return _strip_optional(value)


class StructureNiche(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=12)
    name: str = Field(min_length=1, max_length=120)
    subniches: list[str] = Field(default_factory=list, max_length=30)
    status: str = Field(default="", max_length=20)
    priority: int = Field(default=0, ge=0, le=99)
    notes: str = Field(default="", max_length=500)

    @field_validator("code", "name")
    @classmethod
    def trim_required(cls, value: str) -> str:
        return _clean_required(value, "O campo é obrigatório.")

    @field_validator("status", "notes")
    @classmethod
    def trim_optional(cls, value: str) -> str:
        return _strip_optional(value)

    @field_validator("subniches")
    @classmethod
    def normalize_subniches(cls, values: list[str]) -> list[str]:
        return _clean_names(values, 80, "Os subnichos devem ter entre 1 e 80 caracteres.")


DecisionStatus = Literal["pendente", "decidida"]


class StructureDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(max_length=60, pattern=DECISION_ID_PATTERN)
    title: str = Field(min_length=1, max_length=160)
    question: str = Field(default="", max_length=1000)
    options: list[str] = Field(default_factory=list, max_length=12)
    recommendation: str = Field(default="", max_length=500)
    scope: Literal["geral", "nicho", "idioma", "canal"] = "geral"
    ref: str = Field(default="", max_length=80)
    status: DecisionStatus = "pendente"
    answer: str = Field(default="", max_length=1000)
    notes: str = Field(default="", max_length=2000)
    # Definido pelo servidor; na importação aceita o horário vindo do pacote.
    decided_at: str | None = Field(default=None, max_length=40)

    @field_validator("title")
    @classmethod
    def trim_title(cls, value: str) -> str:
        return _clean_required(value, "Informe o título da decisão.")

    @field_validator("question", "recommendation", "ref", "answer", "notes")
    @classmethod
    def trim_optional(cls, value: str) -> str:
        return _strip_optional(value)

    @field_validator("options")
    @classmethod
    def normalize_options(cls, values: list[str]) -> list[str]:
        return _clean_names(values, 200, "As opções devem ter entre 1 e 200 caracteres.")

    @field_validator("decided_at")
    @classmethod
    def validate_decided_at(cls, value: str | None) -> str | None:
        return _validate_aware_timestamp(value) if value else None

    @model_validator(mode="after")
    def decided_needs_answer(self):
        if self.status == "decidida" and not self.answer:
            raise ValueError("Uma decisão tomada precisa de resposta.")
        return self


def _reject_duplicate_codes(
    languages: list[StructureLanguage],
    niches: list[StructureNiche],
    decisions: list[StructureDecision] | None,
    channels: list | None = None,
) -> None:
    for label, values in (
        ("idioma", [item.code for item in languages]),
        ("nicho", [item.code for item in niches]),
        ("decisão", [item.id for item in decisions or []]),
        ("canal (external_id)", [item.external_id for item in channels or []]),
    ):
        if len(values) != len(set(values)):
            raise ValueError(f"A estrutura contém {label} repetido.")


class PackageChannel(ChannelStructureFields):
    """Canal dentro do pacote: mesmas regras do cadastro, com external_id obrigatório."""

    external_id: str = Field(max_length=80, pattern=EXTERNAL_ID_PATTERN)


class StructurePackage(BaseModel):
    # Chaves extras no topo (ex.: generated_at) são aceitas e ignoradas.
    model_config = ConfigDict(extra="ignore")

    schema_: str = Field(alias="schema")
    name: str = Field(min_length=1, max_length=120)
    template_id: str | None = Field(default=None, max_length=40)
    languages: list[StructureLanguage] = Field(default_factory=list, max_length=200)
    niches: list[StructureNiche] = Field(default_factory=list, max_length=100)
    # Ausente (None) = manter as decisões já salvas; lista = substituir a lista.
    decisions: list[StructureDecision] | None = Field(default=None, max_length=100)
    channels: list[PackageChannel] = Field(default_factory=list, max_length=500)

    @field_validator("schema_")
    @classmethod
    def check_schema(cls, value: str) -> str:
        if value != STRUCTURE_SCHEMA:
            raise ValueError(f"O pacote precisa usar o formato {STRUCTURE_SCHEMA}.")
        return value

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        return _clean_required(value, "Informe o nome da estrutura.")

    @model_validator(mode="after")
    def reject_duplicates(self):
        _reject_duplicate_codes(self.languages, self.niches, self.decisions, self.channels)
        return self


class StructureImport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    package: StructurePackage
    dry_run: bool = True


class StructureUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    languages: list[StructureLanguage] = Field(max_length=200)
    niches: list[StructureNiche] = Field(max_length=100)
    decisions: list[StructureDecision] = Field(max_length=100)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str | None) -> str | None:
        return _clean_required(value, "Informe o nome da estrutura.")

    @model_validator(mode="after")
    def reject_duplicates(self):
        _reject_duplicate_codes(self.languages, self.niches, self.decisions)
        return self


class DecisionPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: DecisionStatus | None = None
    answer: str | None = Field(default=None, max_length=1000)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("answer", "notes")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        return _strip_optional(value)


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


SCRIPT_REVIEW_FIELDS = frozenset({"status", "validation_status"})
SCRIPT_CONTENT_FIELDS = frozenset({"topic", "title", "script"})
WORKFLOW_PUBLISHING_FIELDS = frozenset(
    {"scheduled_at", "target_channels", "publication_url", "published_at"}
)


def script_patch_permissions(changes: dict) -> list[str]:
    """Permissões exigidas por um PATCH de roteiro, uma por parte alterada."""
    workflow = changes.get("workflow") or {}
    required = []
    if SCRIPT_REVIEW_FIELDS & changes.keys():
        required.append("review.write")
    if WORKFLOW_PUBLISHING_FIELDS & workflow.keys():
        required.append("publishing.write")
    if SCRIPT_CONTENT_FIELDS & changes.keys() or workflow.keys() - WORKFLOW_PUBLISHING_FIELDS:
        required.append("production.write")
    # ``workflow`` vazio ({}) não altera nada além do carimbo: vale como edição de produção.
    return required or ["production.write"]


def _find_script(
    session: Session,
    tenant_id: UUID,
    channel_id: UUID,
    script_id: UUID,
) -> TenantRecord:
    # Usado só na edição: ``FOR UPDATE`` põe duas edições do mesmo roteiro em fila
    # (PostgreSQL) e o merge parte da linha gravada, sem perder campos.
    record = session.scalar(
        select(TenantRecord)
        .where(
            TenantRecord.id == script_id,
            TenantRecord.tenant_id == tenant_id,
            TenantRecord.entity_type == "RoteiroCanalDark",
        )
        .with_for_update()
        .execution_options(populate_existing=True)
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


def _serialize_channel(record: TenantRecord) -> dict:
    return {**deepcopy(CHANNEL_DEFAULTS), **_serialize(record)}


def _audit(
    session: Session,
    current: CurrentSession,
    membership_tenant_id: UUID,
    action: str,
    entity_type: str,
    record_id: UUID,
    details: dict | None = None,
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
                "details": details or {},
            },
        )
    )


def _tenant_channels(session: Session, tenant_id: UUID) -> list[TenantRecord]:
    return list(
        session.scalars(
            select(TenantRecord)
            .where(
                TenantRecord.tenant_id == tenant_id,
                TenantRecord.entity_type == "CanalDark",
            )
            .order_by(TenantRecord.created_at, TenantRecord.id)
        )
    )


def _ensure_external_id_available(
    session: Session, tenant_id: UUID, external_id: str, exclude_id: UUID | None = None
) -> None:
    # Arquivados também contam: o identificador continua reservado na empresa.
    for record in _tenant_channels(session, tenant_id):
        if record.id != exclude_id and record.data.get("external_id") == external_id:
            raise PublicError(
                409,
                "DARK_CHANNEL_EXTERNAL_ID_CONFLICT",
                "Já existe um canal com este identificador nesta empresa.",
            )


def _slugify(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")[:80].strip("-")
    return slug or "canal"


def _resolved_external_ids(records: list[TenantRecord]) -> dict[UUID, str]:
    """Identificador de cada canal: o gravado ou um gerado do nome, sem colisão.

    O cálculo é determinístico (ordem de criação), então exportação e importação
    chegam ao mesmo identificador para canais antigos sem external_id.
    """
    taken = {record.data["external_id"] for record in records if record.data.get("external_id")}
    resolved: dict[UUID, str] = {}
    for record in records:
        stored = record.data.get("external_id")
        if stored:
            resolved[record.id] = stored
            continue
        base = _slugify(str(record.data.get("name", "")))
        candidate = base
        counter = 2
        while candidate in taken:
            suffix = f"-{counter}"
            candidate = base[: 80 - len(suffix)].rstrip("-") + suffix
            counter += 1
        taken.add(candidate)
        resolved[record.id] = candidate
    return resolved


def _find_structure(session: Session, tenant_id: UUID) -> TenantRecord | None:
    return session.scalars(
        select(TenantRecord)
        .where(
            TenantRecord.tenant_id == tenant_id,
            TenantRecord.entity_type == STRUCTURE_ENTITY,
        )
        .order_by(TenantRecord.updated_at.desc())
    ).first()


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _normalize_structure(data: dict) -> dict:
    """Cópia da estrutura salva com os campos novos preenchidos (registros antigos)."""
    data = deepcopy(data)
    data["languages"] = [
        {"regional_frame": "", "notes": "", "launch_wave": None, "enabled": True, **language}
        for language in data.get("languages", [])
    ]
    data.setdefault("decisions", [])
    return data


def _default_structure() -> dict:
    package = get_template_package(DEFAULT_TEMPLATE_ID)
    return {
        "schema": STRUCTURE_SCHEMA,
        "name": package["name"],
        "languages": package["languages"],
        "niches": package["niches"],
        "decisions": package["decisions"],
        "source": "padrao",
        "template_id": DEFAULT_TEMPLATE_ID,
        "updated_at": None,
    }


def _current_structure(session: Session, tenant_id: UUID) -> tuple[TenantRecord | None, dict]:
    record = _find_structure(session, tenant_id)
    if record is None:
        return None, _default_structure()
    return record, _normalize_structure(record.data)


def _structure_payload(session: Session, tenant_id: UUID) -> dict:
    record, data = _current_structure(session, tenant_id)
    return {**data, "is_default": record is None}


def _merge_decisions(
    incoming: list[StructureDecision], previous: list[dict], *, from_package: bool
) -> list[dict]:
    """Aplica a nova lista de decisões preservando o histórico das já tomadas.

    - Decidida com a mesma resposta: mantém o decided_at original.
    - Na importação (from_package), uma decisão já tomada na tela nunca volta a
      pendente: status, resposta, notas e decided_at são preservados.
    - No PUT da tela, a lista enviada manda (pode reabrir); decided_at é do servidor.
    """
    previous_by_id = {item.get("id"): item for item in previous}
    now = _now_iso()
    merged = []
    for decision in incoming:
        item = decision.model_dump()
        old = previous_by_id.get(item["id"])
        old_decided = old is not None and old.get("status") == "decidida"
        if from_package and old_decided and item["status"] != "decidida":
            item.update({key: old.get(key) for key in ("status", "answer", "notes", "decided_at")})
        elif item["status"] == "decidida":
            if old_decided and old.get("answer") == item["answer"] and old.get("decided_at"):
                item["decided_at"] = old["decided_at"]
            elif not (from_package and item["decided_at"]):
                item["decided_at"] = now
        else:
            item["decided_at"] = None
        merged.append(item)
    return merged


def _save_structure(
    session: Session, tenant_id: UUID, record: TenantRecord | None, data: dict
) -> TenantRecord:
    if record is None:
        record = TenantRecord(tenant_id=tenant_id, entity_type=STRUCTURE_ENTITY)
        session.add(record)
    record.data = data
    session.flush()
    return record


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
    return {"channels": [_serialize_channel(item) for item in records]}


@router.post("", status_code=201)
def create_channel(body: ChannelCreate, current: Authenticated, session: DbSession):
    require_permission(session, current, "production.write")
    membership = require_membership(current)
    if body.external_id:
        _ensure_external_id_available(session, membership.tenant_id, body.external_id)
    record = TenantRecord(
        tenant_id=membership.tenant_id,
        entity_type="CanalDark",
        data={**body.model_dump(), "archived": False, "materials": []},
    )
    session.add(record)
    session.flush()
    _audit(session, current, membership.tenant_id, "dark_channel.created", "CanalDark", record.id)
    session.commit()
    return _serialize_channel(record)


# As rotas /structure precisam vir antes de /{channel_id} para não serem capturadas.
@router.get("/structure")
def get_structure(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    return _structure_payload(session, membership.tenant_id)


@router.put("/structure")
def update_structure(body: StructureUpdate, current: Authenticated, session: DbSession):
    require_permission(session, current, "production.write")
    membership = require_membership(current)
    record, data = _current_structure(session, membership.tenant_id)
    data = {
        **data,
        "name": body.name or data["name"],
        "languages": [language.model_dump() for language in body.languages],
        "niches": [niche.model_dump() for niche in body.niches],
        "decisions": _merge_decisions(body.decisions, data["decisions"], from_package=False),
        "source": data["source"] if record is not None else "personalizado",
        "updated_at": _now_iso(),
    }
    record = _save_structure(session, membership.tenant_id, record, data)
    _audit(
        session,
        current,
        membership.tenant_id,
        "dark_structure.updated",
        STRUCTURE_ENTITY,
        record.id,
    )
    session.commit()
    return {**data, "is_default": False}


@router.patch("/structure/decisions/{decision_id}")
def update_structure_decision(
    decision_id: str, body: DecisionPatch, current: Authenticated, session: DbSession
):
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise PublicError(422, "EMPTY_UPDATE", "Informe ao menos uma alteração.")
    require_permission(session, current, "production.write")
    membership = require_membership(current)
    record, data = _current_structure(session, membership.tenant_id)
    decisions = data["decisions"]
    index = next(
        (position for position, item in enumerate(decisions) if item.get("id") == decision_id),
        None,
    )
    if index is None:
        raise PublicError(404, "DARK_DECISION_NOT_FOUND", "Decisão não encontrada.")
    previous = decisions[index]
    decision = {**previous, **changes}
    if decision.get("status") == "decidida":
        if not decision.get("answer"):
            raise PublicError(
                422,
                "DARK_DECISION_ANSWER_REQUIRED",
                "Informe a resposta antes de marcar a decisão como tomada.",
            )
        unchanged = (
            previous.get("status") == "decidida"
            and previous.get("answer") == decision["answer"]
            and previous.get("decided_at")
        )
        decision["decided_at"] = previous["decided_at"] if unchanged else _now_iso()
    else:
        decision["decided_at"] = None
    decisions[index] = decision
    data = {**data, "decisions": decisions, "updated_at": _now_iso()}
    record = _save_structure(session, membership.tenant_id, record, data)
    _audit(
        session,
        current,
        membership.tenant_id,
        "dark_structure.decision_updated",
        STRUCTURE_ENTITY,
        record.id,
        details={"decision_id": decision_id, "status": decision.get("status")},
    )
    session.commit()
    return decision


@router.get("/structure/templates")
def get_structure_templates(current: Authenticated):
    require_membership(current)
    return {"templates": list_templates()}


@router.get("/structure/templates/{template_id}")
def get_structure_template(template_id: str, current: Authenticated):
    require_membership(current)
    package = get_template_package(template_id)
    if package is None:
        raise PublicError(404, "DARK_TEMPLATE_NOT_FOUND", "Modelo de estrutura não encontrado.")
    return package


@router.get("/structure/export")
def export_structure(current: Authenticated, session: DbSession):
    membership = require_membership(current)
    structure = _structure_payload(session, membership.tenant_id)
    records = _tenant_channels(session, membership.tenant_id)
    resolved = _resolved_external_ids(records)
    channels = []
    for record in records:
        if record.data.get("archived"):
            continue
        data = {**deepcopy(CHANNEL_DEFAULTS), **record.data, "external_id": resolved[record.id]}
        channels.append({field: data.get(field, "") for field in PACKAGE_CHANNEL_FIELDS})
    return {
        "schema": STRUCTURE_SCHEMA,
        "name": structure["name"],
        "template_id": structure.get("template_id"),
        "generated_at": _now_iso(),
        "languages": structure["languages"],
        "niches": structure["niches"],
        "decisions": structure["decisions"],
        "channels": channels,
    }


@router.post("/structure/import")
def import_structure(body: StructureImport, current: Authenticated, session: DbSession):
    require_permission(session, current, "production.write")
    membership = require_membership(current)
    package = body.package
    if package.template_id is not None and package.template_id not in TEMPLATES:
        raise PublicError(422, "DARK_TEMPLATE_NOT_FOUND", "Modelo de estrutura não encontrado.")

    records = _tenant_channels(session, membership.tenant_id)
    resolved = _resolved_external_ids(records)
    by_external_id = {resolved[record.id]: record for record in records}
    summary: dict[str, list[str]] = {"created": [], "updated": [], "unchanged": []}
    to_create: list[dict] = []
    to_update: list[tuple[TenantRecord, dict]] = []
    for item in package.channels:
        fields = item.model_dump()
        record = by_external_id.get(item.external_id)
        if record is None:
            summary["created"].append(item.external_id)
            to_create.append({**fields, "publishing_mode": "manual", "archived": False})
            continue
        # Nunca remove pastas existentes nem mexe em publicação, arquivamento ou materiais.
        folders = list(
            dict.fromkeys([*record.data.get("topic_folders", []), *fields["topic_folders"]])
        )
        merged = {**record.data, **fields, "topic_folders": folders}
        if merged == record.data:
            summary["unchanged"].append(item.external_id)
        else:
            summary["updated"].append(item.external_id)
            to_update.append((record, merged))

    # Só decisões já salvas pela empresa contam; o modelo padrão não é "salvo".
    structure, saved = _current_structure(session, membership.tenant_id)
    previous_decisions = saved["decisions"] if structure is not None else []
    decisions = (
        previous_decisions
        if package.decisions is None
        else _merge_decisions(package.decisions, previous_decisions, from_package=True)
    )
    result = {
        "dry_run": body.dry_run,
        "structure": {
            "languages_count": len(package.languages),
            "niches_count": len(package.niches),
            "decisions_count": len(decisions),
            "decisions_pending": sum(1 for item in decisions if item.get("status") != "decidida"),
        },
        "channels": summary,
        "errors": [],
    }
    if body.dry_run:
        return result

    structure_data = {
        "schema": STRUCTURE_SCHEMA,
        "name": package.name,
        "languages": [language.model_dump() for language in package.languages],
        "niches": [niche.model_dump() for niche in package.niches],
        "decisions": decisions,
        "source": "padrao" if package.template_id else "importado",
        "template_id": package.template_id,
        "updated_at": _now_iso(),
    }
    structure = _save_structure(session, membership.tenant_id, structure, structure_data)
    for data in to_create:
        session.add(
            TenantRecord(
                tenant_id=membership.tenant_id,
                entity_type="CanalDark",
                data={**data, "materials": []},
            )
        )
    for record, merged in to_update:
        record.data = merged
    session.flush()
    _audit(
        session,
        current,
        membership.tenant_id,
        "dark_structure.imported",
        STRUCTURE_ENTITY,
        structure.id,
        details={key: len(value) for key, value in summary.items()},
    )
    # Uma única transação: se algo falhar antes daqui, nada da importação é gravado.
    session.commit()
    return result


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
    if "external_id" in changes:
        _ensure_external_id_available(
            session, membership.tenant_id, changes["external_id"], exclude_id=record.id
        )
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
    return _serialize_channel(record)


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
    # Cada parte da alteração exige a sua permissão (revisão geral 2026-10-24, achado 5):
    # aprovar e publicar no mesmo PATCH exige review.write E publishing.write.
    for permission in script_patch_permissions(changes):
        require_permission(session, current, permission)
    channel = _find_channel(session, membership.tenant_id, channel_id)
    record = _find_script(session, membership.tenant_id, channel_id, script_id)
    workflow_patch = changes.get("workflow") or {}
    folder_name = workflow_patch.get("folder_name")
    if folder_name and folder_name not in channel.data.get("topic_folders", []):
        raise PublicError(422, "DARK_FOLDER_NOT_FOUND", "A pasta precisa pertencer a este canal.")
    workflow = changes.get("workflow")
    if workflow:
        existing_workflow = record.data.get("workflow", {})
        merged_workflow = {**existing_workflow, **workflow}
        if "metrics" in workflow:
            merged_workflow["metrics"] = {
                **existing_workflow.get("metrics", {}),
                **workflow["metrics"],
            }
        changes["workflow"] = merged_workflow
    content_changed = any(
        key in changes and changes[key] != record.data.get(key) for key in SCRIPT_CONTENT_FIELDS
    )
    was_approved = record.data.get("status") == "approved"
    record.data = {**record.data, **changes}
    if changes.get("status") == "approved":
        record.data["validation_status"] = "passed"
    elif was_approved and content_changed and "status" not in changes:
        # Texto alterado depois da aprovação: a aprovação não vale para o texto novo.
        record.data["status"] = "in_review"
        record.data["validation_status"] = "pending"
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

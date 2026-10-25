from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CarouselBriefing(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: Literal["independent", "project", "script", "transcript"]
    audience: str = ""
    objective: str = ""
    tone: str = ""


class CarouselReference(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["project", "script", "transcript", "asset"]
    id: str
    label: str


class CarouselTextRun(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str
    emphasis: bool = False


class CarouselSlide(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    type: Literal["cover", "content", "cta"]
    title: str = Field(min_length=1, max_length=300)
    body: str = Field(default="", max_length=3000)
    title_runs: list[CarouselTextRun] = Field(default_factory=list)
    body_runs: list[CarouselTextRun] = Field(default_factory=list)
    badge: str = Field(default="", max_length=120)
    action: str = Field(default="", max_length=200)
    image: str | None = None


class CarouselContent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str | None = None
    schema_version: Literal[1]
    tool_type: Literal["carousel"]
    project_id: str | None = None
    title: str = Field(min_length=1, max_length=300)
    format: str = Field(min_length=3, max_length=160)
    template_id: str = Field(min_length=1, max_length=120)
    requested_slide_count: int = Field(ge=1, le=30)
    briefing: CarouselBriefing
    slides: list[CarouselSlide] = Field(max_length=30)
    caption: str = Field(default="", max_length=10000)
    hashtags: list[str] = Field(default_factory=list, max_length=60)
    references: list[CarouselReference] = Field(default_factory=list, max_length=100)

    @field_validator("hashtags")
    @classmethod
    def validate_hashtags(cls, values: list[str]) -> list[str]:
        if any(not value.startswith("#") for value in values):
            raise ValueError("hashtags must start with #")
        return values

    @field_validator("format")
    @classmethod
    def validate_format(cls, value: str) -> str:
        standard = {"4:5", "1:1", "9:16", "16:9", "1.91:1", "3:2"}
        if value in standard:
            return value
        if value.startswith("custom:") and "x" in value.rsplit(":", 1)[-1]:
            return value
        raise ValueError("unsupported carousel format")


class CreativeDocumentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tool_type: Literal["carousel"]
    content: CarouselContent


class CreativeDocumentPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: CarouselContent


class CreativeDocumentApprove(BaseModel):
    """Revisão que o revisor viu; sem ela (clientes antigos) aprova a revisão atual."""

    model_config = ConfigDict(extra="forbid")
    revision: int | None = Field(default=None, ge=1)


class CreativeDocumentPublic(BaseModel):
    id: str
    tool_type: Literal["carousel"]
    content: CarouselContent
    revision: int
    status: Literal["draft", "approved"]
    approved_revision: int | None
    created_date: str
    updated_date: str


class CreativeDocumentList(BaseModel):
    documents: list[CreativeDocumentPublic]


class CreativeExportPublic(BaseModel):
    id: str
    document_id: str
    revision: int
    preset: str
    status: Literal["ready"]
    sha256: str
    size: int
    created_date: str

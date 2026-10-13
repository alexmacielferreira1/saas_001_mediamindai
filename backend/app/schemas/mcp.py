from typing import Any

from pydantic import BaseModel, Field


class MCPToolCall(BaseModel):
    arguments: dict[str, Any] = Field(default_factory=dict)


class MCPQueueCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    module: str = Field(min_length=1, max_length=80)
    instruction: str = Field(min_length=1, max_length=4000)
    target_projects: list[str] = Field(default_factory=list, max_length=500)
    create_projects: list[str] = Field(default_factory=list, max_length=500)
    output_mode: str = Field(pattern="^(internal|external)$")
    execution_mode: str = Field(pattern="^(immediate|queue)$")
    targets: list[dict[str, Any]] = Field(default_factory=list, max_length=500)
    export_name: str | None = Field(default=None, max_length=180)
    export_destination: str | None = Field(default=None, max_length=80)

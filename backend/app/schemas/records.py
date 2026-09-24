from typing import Any

from pydantic import BaseModel, Field


class RecordCreate(BaseModel):
    data: dict[str, Any]


class RecordPatch(BaseModel):
    data: dict[str, Any]


class RecordBulkCreate(BaseModel):
    items: list[dict[str, Any]] = Field(max_length=500)


class RecordQuery(BaseModel):
    filters: dict[str, Any] = Field(default_factory=dict)
    sort: str = "-created_date"
    limit: int = Field(default=100, ge=1, le=500)


class RecordBulkUpdate(BaseModel):
    filters: dict[str, Any] = Field(default_factory=dict)
    data: dict[str, Any]


class RecordList(BaseModel):
    records: list[dict[str, Any]]


class BulkUpdateResult(BaseModel):
    updated: int

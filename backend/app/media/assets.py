from typing import Any

from app.models.identity import TenantRecord


def serialize_asset(record: TenantRecord) -> dict[str, Any]:
    public = {key: value for key, value in record.data.items() if key != "storage_key"}
    asset_id = str(record.id)
    return {
        **public,
        "id": asset_id,
        "tenant_id": str(record.tenant_id),
        "stream_url": f"/api/v1/media/assets/{asset_id}/stream",
        "created_date": record.created_at.isoformat(),
        "updated_date": record.updated_at.isoformat(),
    }

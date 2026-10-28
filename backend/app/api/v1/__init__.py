from fastapi import APIRouter

from app.api.v1.admin_settings import router as admin_settings_router
from app.api.v1.admin_users import router as admin_users_router
from app.api.v1.ai import router as ai_router
from app.api.v1.ai_tools import router as ai_tools_router
from app.api.v1.ai_usage import router as ai_usage_router
from app.api.v1.auth import router as auth_router
from app.api.v1.clips import router as clips_router
from app.api.v1.clipsfree2 import router as clipsfree2_router
from app.api.v1.creative_tools import router as creative_tools_router
from app.api.v1.dark_channels import router as dark_channels_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.ingest import router as ingest_router
from app.api.v1.management import router as management_router
from app.api.v1.mcp import router as mcp_router
from app.api.v1.media import router as media_router
from app.api.v1.memberships import router as memberships_router
from app.api.v1.permission_groups import router as permission_groups_router
from app.api.v1.records import router as records_router
from app.api.v1.tenants import router as tenants_router
from app.api.v1.thumbnail_settings import router as thumbnail_settings_router
from app.api.v1.uploads import router as uploads_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router)
router.include_router(creative_tools_router)
router.include_router(admin_users_router)
router.include_router(admin_settings_router)
router.include_router(ai_router)
router.include_router(ai_usage_router)
router.include_router(ai_tools_router)
router.include_router(dashboard_router)
router.include_router(dark_channels_router)
router.include_router(tenants_router)
router.include_router(permission_groups_router)
router.include_router(memberships_router)
router.include_router(management_router)
router.include_router(mcp_router)
router.include_router(media_router)
router.include_router(ingest_router)
router.include_router(clips_router)
router.include_router(clipsfree2_router)
router.include_router(records_router)
router.include_router(uploads_router)

router.include_router(thumbnail_settings_router)

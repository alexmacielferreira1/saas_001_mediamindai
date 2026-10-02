from fastapi import APIRouter

from app.api.v1.admin_users import router as admin_users_router
from app.api.v1.admin_settings import router as admin_settings_router
from app.api.v1.ai import router as ai_router
from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.management import router as management_router
from app.api.v1.media import router as media_router
from app.api.v1.memberships import router as memberships_router
from app.api.v1.permission_groups import router as permission_groups_router
from app.api.v1.records import router as records_router
from app.api.v1.tenants import router as tenants_router
from app.api.v1.uploads import router as uploads_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router)
router.include_router(admin_users_router)
router.include_router(admin_settings_router)
router.include_router(ai_router)
router.include_router(dashboard_router)
router.include_router(tenants_router)
router.include_router(permission_groups_router)
router.include_router(memberships_router)
router.include_router(management_router)
router.include_router(media_router)
router.include_router(records_router)
router.include_router(uploads_router)

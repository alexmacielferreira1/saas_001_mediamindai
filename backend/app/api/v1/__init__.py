from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.memberships import router as memberships_router
from app.api.v1.permission_groups import router as permission_groups_router
from app.api.v1.tenants import router as tenants_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router)
router.include_router(tenants_router)
router.include_router(permission_groups_router)
router.include_router(memberships_router)

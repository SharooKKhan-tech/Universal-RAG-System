from fastapi import APIRouter, Depends

from app.services.cache_service import (
    check_redis_connection,
    get_cache_stats,
    reset_cache_stats,
    delete_project_chat_cache
)
from app.api.routes_documents import flexible_auth, check_flexible_project_access

router = APIRouter()


@router.get("/cache/health")
def cache_health():
    connected = check_redis_connection()
    return {
        "status": "ok" if connected else "offline",
        "cache": "redis",
        "connected": connected
    }


@router.get("/cache/stats/{project_id}")
def project_cache_stats(
    project_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)
    return get_cache_stats(project_id)


@router.delete("/cache/project/{project_id}")
def clear_project_cache(
    project_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)
    return delete_project_chat_cache(project_id)


@router.post("/cache/stats/{project_id}/reset")
def reset_project_cache_stats(
    project_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)
    return reset_cache_stats(project_id)
from fastapi import APIRouter, Depends, HTTPException

from app.core.security import verify_api_key, ensure_project_access
from app.services.cache_service import (
    check_redis_connection,
    get_cache_stats,
    reset_cache_stats,
    delete_project_chat_cache
)

router = APIRouter()


@router.get("/cache/health")
def cache_health():
    connected = check_redis_connection()

    return {
        "status": "ok" if connected else "failed",
        "cache": "redis",
        "connected": connected
    }


@router.get("/cache/stats/{project_id}")
def project_cache_stats(
    project_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return get_cache_stats(project_id)


@router.delete("/cache/project/{project_id}")
def clear_project_cache(
    project_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return delete_project_chat_cache(project_id)


@router.post("/cache/stats/{project_id}/reset")
def reset_project_cache_stats(
    project_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return reset_cache_stats(project_id)
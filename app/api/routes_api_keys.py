from fastapi import APIRouter, HTTPException, Depends

from app.db.schemas import ApiKeyCreate, ApiKeyResponse
from app.db.models import User
from app.core.auth import get_current_user, check_project_access
from app.services.api_key_service import (
    create_api_key,
    get_api_keys_by_project,
    delete_api_key
)

router = APIRouter()


@router.post("/projects/{project_id}/api-keys", response_model=ApiKeyResponse)
def generate_project_api_key(
    project_id: str,
    request: ApiKeyCreate,
    user: User = Depends(get_current_user)
):
    check_project_access(user, project_id)
    return create_api_key(project_id, request)


@router.get("/projects/{project_id}/api-keys")
def list_project_api_keys(
    project_id: str,
    user: User = Depends(get_current_user)
):
    check_project_access(user, project_id)
    return get_api_keys_by_project(project_id)


@router.delete("/projects/{project_id}/api-keys/{api_key_id}")
def remove_project_api_key(
    project_id: str,
    api_key_id: str,
    user: User = Depends(get_current_user)
):
    check_project_access(user, project_id)
    deleted = delete_api_key(project_id, api_key_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="API key not found")

    return {
        "message": "API key deleted successfully",
        "api_key_id": api_key_id
    }
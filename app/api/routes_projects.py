from fastapi import APIRouter, HTTPException, Depends

from app.db.schemas import ProjectCreate, ProjectResponse
from app.db.models import User
from app.services.project_service import (
    create_project,
    get_projects_for_user,
    get_project_by_id
)
from app.services.project_cleanup_service import delete_project_completely
from app.core.security import verify_api_key, ensure_project_access
from app.core.auth import get_current_user, check_project_access

router = APIRouter()


@router.post("/projects")
def create_new_project(
    project: ProjectCreate,
    user: User = Depends(get_current_user)
):
    """Create a project scoped to the logged-in user's client."""
    return create_project(project, user)


@router.get("/projects")
def list_projects(user: User = Depends(get_current_user)):
    """List only projects belonging to the logged-in user's client (SUPER_ADMIN sees all)."""
    return get_projects_for_user(user)


@router.get("/projects/{project_id}")
def get_project(
    project_id: str,
    user: User = Depends(get_current_user)
):
    """Get a single project — enforces client isolation."""
    # Verify the user actually has access to this project
    check_project_access(user, project_id)

    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return project


@router.delete("/projects/{project_id}")
def remove_project(
    project_id: str,
    user: User = Depends(get_current_user)
):
    """Delete a project completely — only accessible by CLIENT_ADMIN or SUPER_ADMIN."""
    check_project_access(user, project_id)
    
    if user.role not in ["CLIENT_ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(
            status_code=403,
            detail="Permission denied: Only client administrators can delete projects."
        )
        
    return delete_project_completely(project_id)
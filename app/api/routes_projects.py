from fastapi import APIRouter, HTTPException, Depends

from app.db.schemas import ProjectCreate, ProjectResponse
from app.services.project_service import (
    create_project,
    get_all_projects,
    get_project_by_id
)
from app.services.project_cleanup_service import delete_project_completely
from app.core.security import verify_api_key, ensure_project_access

router = APIRouter()


@router.post("/projects", response_model=ProjectResponse)
def create_new_project(project: ProjectCreate):
    return create_project(project)


@router.get("/projects")
def list_projects():
    return get_all_projects()


@router.get("/projects/{project_id}")
def get_project(project_id: str):
    project = get_project_by_id(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return project


@router.delete("/projects/{project_id}")
def remove_project(
    project_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return delete_project_completely(project_id)
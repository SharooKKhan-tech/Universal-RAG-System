from fastapi import APIRouter, HTTPException
from app.db.schemas import ProjectCreate, ProjectResponse
from app.services.project_service import (
    create_project,
    get_all_projects,
    get_project_by_id,
    delete_project
)

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
def remove_project(project_id: str):
    deleted = delete_project(project_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")

    return {
        "message": "Project deleted successfully",
        "project_id": project_id
    }
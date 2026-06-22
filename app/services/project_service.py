from uuid import uuid4
from sqlalchemy import select
from typing import Optional

from app.db.schemas import ProjectCreate
from app.db.models import Project, User
from app.db.sync_database import SessionLocal


def project_to_dict(project: Project):
    return {
        "id": project.id,
        "client_id": project.client_id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at
    }


def create_project(project_data: ProjectCreate, user: User):
    with SessionLocal() as db:
        new_project = Project(
            id=str(uuid4()),
            name=project_data.name,
            description=project_data.description,
            client_id=user.client_id,   # Always tied to the creating user's client
            created_by=user.id
        )

        db.add(new_project)
        db.commit()
        db.refresh(new_project)

        return project_to_dict(new_project)


def get_projects_for_user(user: User):
    """Return projects scoped to the logged-in user's client (SUPER_ADMIN sees all)."""
    with SessionLocal() as db:
        if user.role == "SUPER_ADMIN":
            result = db.execute(select(Project).order_by(Project.created_at.desc()))
        else:
            # CLIENT_ADMIN and all other roles: only their client's projects
            result = db.execute(
                select(Project)
                .where(Project.client_id == user.client_id)
                .order_by(Project.created_at.desc())
            )

        projects = result.scalars().all()
        return [project_to_dict(p) for p in projects]


def get_all_projects():
    """Legacy: returns all projects (kept for internal/E2E use only)."""
    with SessionLocal() as db:
        result = db.execute(select(Project).order_by(Project.created_at.desc()))
        projects = result.scalars().all()
        return [project_to_dict(project) for project in projects]


def get_project_by_id(project_id: str):
    with SessionLocal() as db:
        project = db.get(Project, project_id)

        if not project:
            return None

        return project_to_dict(project)


def delete_project(project_id: str):
    with SessionLocal() as db:
        project = db.get(Project, project_id)

        if not project:
            return False

        db.delete(project)
        db.commit()

        return True
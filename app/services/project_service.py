from uuid import uuid4
from sqlalchemy import select

from app.db.schemas import ProjectCreate
from app.db.models import Project
from app.db.sync_database import SessionLocal


def project_to_dict(project: Project):
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at
    }


def create_project(project_data: ProjectCreate):
    with SessionLocal() as db:
        new_project = Project(
            id=str(uuid4()),
            name=project_data.name,
            description=project_data.description,
            client_id=None
        )

        db.add(new_project)
        db.commit()
        db.refresh(new_project)

        return project_to_dict(new_project)


def get_all_projects():
    with SessionLocal() as db:
        result = db.execute(
            select(Project).order_by(Project.created_at.desc())
        )

        projects = result.scalars().all()

        return [
            project_to_dict(project)
            for project in projects
        ]


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
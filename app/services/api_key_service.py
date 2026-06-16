import secrets
from uuid import uuid4
from sqlalchemy import select
from fastapi import HTTPException

from app.db.schemas import ApiKeyCreate
from app.db.models import Project, ProjectApiKey
from app.db.sync_database import SessionLocal


def generate_api_key_value() -> str:
    return f"rag_sk_{secrets.token_urlsafe(32)}"


def mask_api_key(api_key: str) -> str:
    if len(api_key) <= 14:
        return "****"

    return f"{api_key[:10]}...{api_key[-4:]}"


def api_key_to_dict(api_key: ProjectApiKey, include_full_key: bool = False):
    data = {
        "id": api_key.id,
        "project_id": api_key.project_id,
        "name": api_key.name,
        "is_active": api_key.is_active,
        "created_at": api_key.created_at
    }

    if include_full_key:
        data["api_key"] = api_key.api_key
    else:
        data["api_key_preview"] = mask_api_key(api_key.api_key)

    return data


def create_api_key(project_id: str, api_key_data: ApiKeyCreate):
    with SessionLocal() as db:
        project = db.get(Project, project_id)

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        new_api_key = ProjectApiKey(
            id=str(uuid4()),
            project_id=project_id,
            name=api_key_data.name,
            api_key=generate_api_key_value(),
            is_active=True
        )

        db.add(new_api_key)
        db.commit()
        db.refresh(new_api_key)

        return api_key_to_dict(new_api_key, include_full_key=True)


def get_api_keys_by_project(project_id: str):
    with SessionLocal() as db:
        result = db.execute(
            select(ProjectApiKey)
            .where(ProjectApiKey.project_id == project_id)
            .order_by(ProjectApiKey.created_at.desc())
        )

        api_keys = result.scalars().all()

        return [
            api_key_to_dict(api_key, include_full_key=False)
            for api_key in api_keys
        ]


def get_api_key_record(api_key_value: str):
    with SessionLocal() as db:
        result = db.execute(
            select(ProjectApiKey)
            .where(ProjectApiKey.api_key == api_key_value)
            .where(ProjectApiKey.is_active == True)
        )

        api_key = result.scalar_one_or_none()

        if not api_key:
            return None

        return {
            "id": api_key.id,
            "project_id": api_key.project_id,
            "name": api_key.name,
            "api_key": api_key.api_key,
            "is_active": api_key.is_active,
            "created_at": api_key.created_at
        }


def delete_api_key(project_id: str, api_key_id: str):
    with SessionLocal() as db:
        result = db.execute(
            select(ProjectApiKey)
            .where(ProjectApiKey.id == api_key_id)
            .where(ProjectApiKey.project_id == project_id)
        )

        api_key = result.scalar_one_or_none()

        if not api_key:
            return False

        db.delete(api_key)
        db.commit()

        return True


def delete_api_keys_by_project(project_id: str):
    with SessionLocal() as db:
        result = db.execute(
            select(ProjectApiKey)
            .where(ProjectApiKey.project_id == project_id)
        )

        api_keys = result.scalars().all()

        deleted_count = len(api_keys)

        for api_key in api_keys:
            db.delete(api_key)

        db.commit()

        return {
            "message": "Project API keys deleted successfully",
            "project_id": project_id,
            "deleted_count": deleted_count
        }
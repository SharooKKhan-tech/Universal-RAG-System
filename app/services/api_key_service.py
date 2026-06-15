import json
import secrets
from uuid import uuid4
from pathlib import Path
from datetime import datetime
from fastapi import HTTPException

from app.db.schemas import ApiKeyCreate
from app.services.project_service import get_project_by_id

DATA_DIR = Path("data")
API_KEYS_FILE = DATA_DIR / "api_keys.json"


def ensure_api_key_storage_exists():
    DATA_DIR.mkdir(exist_ok=True)

    if not API_KEYS_FILE.exists():
        API_KEYS_FILE.write_text("[]", encoding="utf-8")


def load_api_keys():
    ensure_api_key_storage_exists()

    with open(API_KEYS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def save_api_keys(api_keys):
    ensure_api_key_storage_exists()

    with open(API_KEYS_FILE, "w", encoding="utf-8") as file:
        json.dump(api_keys, file, indent=4)


def generate_api_key_value() -> str:
    return f"rag_sk_{secrets.token_urlsafe(32)}"


def mask_api_key(api_key: str) -> str:
    if len(api_key) <= 14:
        return "****"

    return f"{api_key[:10]}...{api_key[-4:]}"


def create_api_key(project_id: str, api_key_data: ApiKeyCreate):
    project = get_project_by_id(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    api_keys = load_api_keys()

    new_api_key = {
        "id": str(uuid4()),
        "project_id": project_id,
        "name": api_key_data.name,
        "api_key": generate_api_key_value(),
        "is_active": True,
        "created_at": datetime.utcnow().isoformat()
    }

    api_keys.append(new_api_key)
    save_api_keys(api_keys)

    return new_api_key


def get_api_keys_by_project(project_id: str):
    api_keys = load_api_keys()

    project_keys = [
        api_key for api_key in api_keys
        if api_key["project_id"] == project_id
    ]

    safe_keys = []

    for api_key in project_keys:
        safe_keys.append({
            "id": api_key["id"],
            "project_id": api_key["project_id"],
            "name": api_key["name"],
            "api_key_preview": mask_api_key(api_key["api_key"]),
            "is_active": api_key["is_active"],
            "created_at": api_key["created_at"]
        })

    return safe_keys


def get_api_key_record(api_key_value: str):
    api_keys = load_api_keys()

    for api_key in api_keys:
        if api_key["api_key"] == api_key_value and api_key["is_active"]:
            return api_key

    return None


def delete_api_key(project_id: str, api_key_id: str):
    api_keys = load_api_keys()

    updated_api_keys = []
    deleted = False

    for api_key in api_keys:
        if api_key["id"] == api_key_id and api_key["project_id"] == project_id:
            deleted = True
            continue

        updated_api_keys.append(api_key)

    if not deleted:
        return False

    save_api_keys(updated_api_keys)
    return True

def delete_api_keys_by_project(project_id: str):
    api_keys = load_api_keys()

    remaining_api_keys = [
        api_key for api_key in api_keys
        if api_key["project_id"] != project_id
    ]

    deleted_count = len(api_keys) - len(remaining_api_keys)

    save_api_keys(remaining_api_keys)

    return {
        "message": "Project API keys deleted successfully",
        "project_id": project_id,
        "deleted_count": deleted_count
    }
import json
from uuid import uuid4
from pathlib import Path
from datetime import datetime
from app.db.schemas import ProjectCreate

DATA_DIR = Path("data")
PROJECTS_FILE = DATA_DIR / "projects.json"


def ensure_storage_exists():
    DATA_DIR.mkdir(exist_ok=True)

    if not PROJECTS_FILE.exists():
        PROJECTS_FILE.write_text("[]")


def load_projects():
    ensure_storage_exists()

    with open(PROJECTS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def save_projects(projects):
    ensure_storage_exists()

    with open(PROJECTS_FILE, "w", encoding="utf-8") as file:
        json.dump(projects, file, indent=4)


def create_project(project_data: ProjectCreate):
    projects = load_projects()

    new_project = {
        "id": str(uuid4()),
        "name": project_data.name,
        "description": project_data.description,
        "created_at": datetime.utcnow().isoformat()
    }

    projects.append(new_project)
    save_projects(projects)

    return new_project


def get_all_projects():
    return load_projects()


def get_project_by_id(project_id: str):
    projects = load_projects()

    for project in projects:
        if project["id"] == project_id:
            return project

    return None


def delete_project(project_id: str):
    projects = load_projects()

    updated_projects = [
        project for project in projects
        if project["id"] != project_id
    ]

    if len(projects) == len(updated_projects):
        return False

    save_projects(updated_projects)
    return True
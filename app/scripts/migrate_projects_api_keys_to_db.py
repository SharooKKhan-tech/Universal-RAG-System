import json
from pathlib import Path
from datetime import datetime
from sqlalchemy import select

from app.db.models import Project, ProjectApiKey
from app.db.sync_database import SessionLocal

DATA_DIR = Path("data")
PROJECTS_FILE = DATA_DIR / "projects.json"
API_KEYS_FILE = DATA_DIR / "api_keys.json"


def parse_datetime(value):
    if not value:
        return datetime.utcnow()

    try:
        return datetime.fromisoformat(value)
    except Exception:
        return datetime.utcnow()


def migrate_projects():
    if not PROJECTS_FILE.exists():
        print("projects.json not found. Skipping projects migration.")
        return

    projects = json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))

    with SessionLocal() as db:
        migrated_count = 0

        for item in projects:
            existing = db.get(Project, item["id"])

            if existing:
                continue

            project = Project(
                id=item["id"],
                name=item["name"],
                description=item.get("description"),
                client_id=None,
                created_at=parse_datetime(item.get("created_at"))
            )

            db.add(project)
            migrated_count += 1

        db.commit()

    print(f"Projects migrated: {migrated_count}")


def migrate_api_keys():
    if not API_KEYS_FILE.exists():
        print("api_keys.json not found. Skipping API keys migration.")
        return

    api_keys = json.loads(API_KEYS_FILE.read_text(encoding="utf-8"))

    with SessionLocal() as db:
        migrated_count = 0

        for item in api_keys:
            existing = db.execute(
                select(ProjectApiKey)
                .where(ProjectApiKey.api_key == item["api_key"])
            ).scalar_one_or_none()

            if existing:
                continue

            project = db.get(Project, item["project_id"])

            if not project:
                print(f"Skipping API key because project not found: {item['project_id']}")
                continue

            api_key = ProjectApiKey(
                id=item["id"],
                project_id=item["project_id"],
                name=item["name"],
                api_key=item["api_key"],
                is_active=item.get("is_active", True),
                created_at=parse_datetime(item.get("created_at"))
            )

            db.add(api_key)
            migrated_count += 1

        db.commit()

    print(f"API keys migrated: {migrated_count}")


if __name__ == "__main__":
    migrate_projects()
    migrate_api_keys()
    print("Migration completed.")
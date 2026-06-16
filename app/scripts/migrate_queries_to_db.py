import json
from pathlib import Path
from datetime import datetime

from app.db.models import QueryLog, Project
from app.db.sync_database import SessionLocal

DATA_DIR = Path("data")
QUERIES_FILE = DATA_DIR / "queries.json"


def parse_datetime(value):
    if not value:
        return datetime.utcnow()

    try:
        return datetime.fromisoformat(value)
    except Exception:
        return datetime.utcnow()


def migrate_queries():
    if not QUERIES_FILE.exists():
        print("queries.json not found. Skipping query migration.")
        return

    queries = json.loads(QUERIES_FILE.read_text(encoding="utf-8"))

    with SessionLocal() as db:
        migrated_count = 0

        for item in queries:
            existing = db.get(QueryLog, item["id"])

            if existing:
                continue

            project = db.get(Project, item["project_id"])

            if not project:
                print(f"Skipping query because project not found: {item['id']}")
                continue

            sources = item.get("sources", []) or []

            query_log = QueryLog(
                id=item["id"],
                project_id=item["project_id"],
                question=item.get("question", ""),
                answer=item.get("answer", ""),
                sources=sources,
                source_count=item.get("source_count", len(sources)),
                top_similarity_score=item.get("top_similarity_score"),
                confidence=item.get("confidence"),
                status=item.get("status", "answered"),
                latency_ms=item.get("latency_ms", 0),
                model_name=item.get("model_name", "phi3:mini"),
                created_at=parse_datetime(item.get("created_at"))
            )

            db.add(query_log)
            migrated_count += 1

        db.commit()

    print(f"Queries migrated: {migrated_count}")


if __name__ == "__main__":
    migrate_queries()
    print("Query migration completed.")
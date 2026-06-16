import json
from pathlib import Path
from datetime import datetime

from app.db.models import Document, Chunk, Project
from app.db.sync_database import SessionLocal

DATA_DIR = Path("data")
DOCUMENTS_FILE = DATA_DIR / "documents.json"
CHUNKS_FILE = DATA_DIR / "chunks.json"


def parse_datetime(value):
    if not value:
        return datetime.utcnow()

    try:
        return datetime.fromisoformat(value)
    except Exception:
        return datetime.utcnow()


def migrate_documents():
    if not DOCUMENTS_FILE.exists():
        print("documents.json not found. Skipping documents migration.")
        return

    documents = json.loads(DOCUMENTS_FILE.read_text(encoding="utf-8"))

    with SessionLocal() as db:
        migrated_count = 0

        for item in documents:
            existing = db.get(Document, item["id"])

            if existing:
                continue

            project = db.get(Project, item["project_id"])

            if not project:
                print(f"Skipping document because project not found: {item['id']}")
                continue

            document = Document(
                id=item["id"],
                project_id=item["project_id"],
                file_name=item["file_name"],
                file_type=item["file_type"],
                file_path=item["file_path"],
                text_path=item.get("text_path"),
                status=item.get("status", "uploaded"),
                error_message=item.get("error_message"),
                created_at=parse_datetime(item.get("created_at"))
            )

            db.add(document)
            migrated_count += 1

        db.commit()

    print(f"Documents migrated: {migrated_count}")


def migrate_chunks():
    if not CHUNKS_FILE.exists():
        print("chunks.json not found. Skipping chunks migration.")
        return

    chunks = json.loads(CHUNKS_FILE.read_text(encoding="utf-8"))

    with SessionLocal() as db:
        migrated_count = 0

        for item in chunks:
            existing = db.get(Chunk, item["id"])

            if existing:
                continue

            document = db.get(Document, item["document_id"])

            if not document:
                print(f"Skipping chunk because document not found: {item['id']}")
                continue

            chunk = Chunk(
                id=item["id"],
                project_id=item["project_id"],
                document_id=item["document_id"],
                chunk_text=item["chunk_text"],
                chunk_index=item["chunk_index"],
                page_number=item.get("page_number"),
                vector_id=item.get("vector_id"),
                created_at=parse_datetime(item.get("created_at"))
            )

            db.add(chunk)
            migrated_count += 1

        db.commit()

    print(f"Chunks migrated: {migrated_count}")


if __name__ == "__main__":
    migrate_documents()
    migrate_chunks()
    print("Documents and chunks migration completed.")
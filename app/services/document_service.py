import re
from uuid import uuid4
from pathlib import Path
from datetime import datetime
from fastapi import UploadFile, HTTPException
from sqlalchemy import select

from app.db.models import Project, Document
from app.db.sync_database import SessionLocal
from app.ingestion.loaders import extract_text_from_file

UPLOADS_DIR = Path("uploads")
DATA_DIR = Path("data")
EXTRACTED_TEXT_DIR = DATA_DIR / "extracted_text"

SUPPORTED_FILE_TYPES = {"pdf", "txt"}


def ensure_document_storage_exists():
    UPLOADS_DIR.mkdir(exist_ok=True)
    DATA_DIR.mkdir(exist_ok=True)
    EXTRACTED_TEXT_DIR.mkdir(parents=True, exist_ok=True)


def clean_filename(filename: str) -> str:
    filename = Path(filename).name
    filename = filename.replace(" ", "_")
    filename = re.sub(r"[^a-zA-Z0-9_.-]", "", filename)
    return filename


def document_to_dict(document: Document):
    return {
        "id": document.id,
        "project_id": document.project_id,
        "file_name": document.file_name,
        "file_type": document.file_type,
        "file_path": document.file_path,
        "text_path": document.text_path,
        "status": document.status,
        "error_message": document.error_message,
        "created_at": document.created_at
    }


async def upload_and_process_document(project_id: str, file: UploadFile):
    ensure_document_storage_exists()

    with SessionLocal() as db:
        project = db.get(Project, project_id)

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        original_filename = clean_filename(file.filename)
        file_extension = Path(original_filename).suffix.lower().replace(".", "")

        if file_extension not in SUPPORTED_FILE_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Only PDF and TXT files are supported"
            )

        document_id = str(uuid4())

        project_upload_dir = UPLOADS_DIR / project_id
        project_upload_dir.mkdir(parents=True, exist_ok=True)

        stored_file_path = project_upload_dir / f"{document_id}_{original_filename}"

        file_bytes = await file.read()
        stored_file_path.write_bytes(file_bytes)

        document = Document(
            id=document_id,
            project_id=project_id,
            file_name=original_filename,
            file_type=file_extension,
            file_path=str(stored_file_path),
            text_path=None,
            status="processing",
            error_message=None,
            created_at=datetime.utcnow()
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        try:
            extracted_text = extract_text_from_file(
                file_path=str(stored_file_path),
                file_type=file_extension
            )

            if not extracted_text.strip():
                raise ValueError("No readable text found in document")

            text_file_path = EXTRACTED_TEXT_DIR / f"{document_id}.txt"
            text_file_path.write_text(
                extracted_text,
                encoding="utf-8",
                errors="ignore"
            )

            document.text_path = str(text_file_path)
            document.status = "text_extracted"
            document.error_message = None

        except Exception as error:
            document.status = "failed"
            document.error_message = str(error)

        db.commit()
        db.refresh(document)

        return document_to_dict(document)


def get_documents_by_project(project_id: str, status: str | None = None):
    with SessionLocal() as db:
        query = select(Document).where(Document.project_id == project_id)

        if status:
            query = query.where(Document.status == status)

        query = query.order_by(Document.created_at.desc())

        result = db.execute(query)
        documents = result.scalars().all()

        return [
            document_to_dict(document)
            for document in documents
        ]


def get_document_by_id(document_id: str):
    with SessionLocal() as db:
        document = db.get(Document, document_id)

        if not document:
            return None

        return document_to_dict(document)


def update_document_status(document_id: str, status: str, error_message=None):
    with SessionLocal() as db:
        document = db.get(Document, document_id)

        if not document:
            return None

        document.status = status
        document.error_message = error_message

        db.commit()
        db.refresh(document)

        return document_to_dict(document)
from pathlib import Path
from uuid import uuid4
from datetime import datetime
from fastapi import UploadFile, HTTPException

from app.db.models import Project, Document
from app.db.sync_database import SessionLocal
from app.ingestion.loaders import extract_text_from_file
from app.services.document_service import (
    clean_filename,
    ensure_document_storage_exists,
    document_to_dict,
    get_document_by_id,
    update_document_status
)
from app.services.chunk_service import chunk_document
from app.services.vector_service import index_document_chunks
from app.services.cache_service import delete_project_chat_cache

UPLOADS_DIR = Path("uploads")
DATA_DIR = Path("data")
EXTRACTED_TEXT_DIR = DATA_DIR / "extracted_text"

SUPPORTED_FILE_TYPES = {"pdf", "txt"}


async def upload_document_for_background_processing(
    project_id: str,
    file: UploadFile
):
    """
    Saves uploaded file and creates document record with queued status.
    Actual extraction/chunking/indexing happens in background.
    """

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
            status="queued",
            error_message=None,
            created_at=datetime.utcnow()
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        return {
            "message": "Document uploaded successfully. Processing started in background.",
            "document_id": document.id,
            "project_id": document.project_id,
            "file_name": document.file_name,
            "status": document.status,
            "next_step": f"Check status using GET /api/v1/documents/status/{document.id}"
        }


def update_document_text_path_and_status(
    document_id: str,
    text_path: str,
    status: str
):
    with SessionLocal() as db:
        document = db.get(Document, document_id)

        if not document:
            return None

        document.text_path = text_path
        document.status = status
        document.error_message = None

        db.commit()
        db.refresh(document)

        return document_to_dict(document)


def process_document_in_background(document_id: str):
    """
    Background job:
    Extract text -> Chunk -> Index -> Clear cache
    """

    try:
        document = get_document_by_id(document_id)

        if not document:
            return

        update_document_status(document_id, "processing")

        extracted_text = extract_text_from_file(
            file_path=document["file_path"],
            file_type=document["file_type"]
        )

        if not extracted_text.strip():
            raise ValueError("No readable text found in document")

        EXTRACTED_TEXT_DIR.mkdir(parents=True, exist_ok=True)

        text_file_path = EXTRACTED_TEXT_DIR / f"{document_id}.txt"
        text_file_path.write_text(
            extracted_text,
            encoding="utf-8",
            errors="ignore"
        )

        update_document_text_path_and_status(
            document_id=document_id,
            text_path=str(text_file_path),
            status="text_extracted"
        )

        chunk_document(document_id)

        index_document_chunks(document_id)

        updated_document = get_document_by_id(document_id)

        if updated_document:
            delete_project_chat_cache(updated_document["project_id"])

    except Exception as error:
        update_document_status(
            document_id=document_id,
            status="failed",
            error_message=str(error)
        )
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

        from app.core.storage import storage_provider
        
        # Save to temporary path
        temp_dir = Path("uploads/tmp")
        temp_dir.mkdir(parents=True, exist_ok=True)
        temp_path = temp_dir / f"{document_id}_{original_filename}"
        
        try:
            file_bytes = await file.read()
            temp_path.write_bytes(file_bytes)
            
            # Upload via storage provider
            stored_file_path = storage_provider.upload_file(
                temp_path, 
                f"{project_id}/{document_id}_{original_filename}"
            )
        finally:
            if temp_path.exists():
                temp_path.unlink()

        document = Document(
            id=document_id,
            project_id=project_id,
            file_name=original_filename,
            file_type=file_extension,
            file_path=stored_file_path,
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

        from app.core.storage import storage_provider

        # Download file to local temporary path to extract text
        temp_local_path = Path("uploads/tmp") / f"extract_{document_id}.{document['file_type']}"
        temp_local_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            storage_provider.download_file(document["file_path"], temp_local_path)
            extracted_text = extract_text_from_file(
                file_path=str(temp_local_path),
                file_type=document["file_type"]
            )
        finally:
            if temp_local_path.exists():
                temp_local_path.unlink()

        if not extracted_text.strip():
            raise ValueError("No readable text found in document")

        # Save extracted text to temporary file and upload
        temp_text_path = Path("uploads/tmp") / f"extracted_{document_id}.txt"
        temp_text_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            temp_text_path.write_text(
                extracted_text,
                encoding="utf-8",
                errors="ignore"
            )
            stored_text_path = storage_provider.upload_file(
                temp_text_path,
                f"extracted_text/{document_id}.txt"
            )
        finally:
            if temp_text_path.exists():
                temp_text_path.unlink()

        update_document_text_path_and_status(
            document_id=document_id,
            text_path=stored_text_path,
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
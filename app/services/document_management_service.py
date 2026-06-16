from pathlib import Path
from fastapi import HTTPException

from app.db.models import Document
from app.db.sync_database import SessionLocal

from app.services.document_service import get_document_by_id
from app.services.chunk_service import get_chunks_by_document, delete_chunks_by_document
from app.services.vector_service import delete_vectors_for_document
from app.services.cache_service import delete_project_chat_cache


def delete_file_if_exists(file_path: str | None):
    if not file_path:
        return False

    path = Path(file_path)

    if path.exists():
        path.unlink()
        return True

    return False


def delete_document_record(document_id: str):
    with SessionLocal() as db:
        document = db.get(Document, document_id)

        if not document:
            return False

        db.delete(document)
        db.commit()

        return True


def delete_document_completely(document_id: str):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    project_id = document["project_id"]

    # 1. Delete vectors from ChromaDB
    vector_result = delete_vectors_for_document(document_id)

    # 2. Delete chunks from PostgreSQL
    existing_chunks = get_chunks_by_document(document_id)
    deleted_chunks_count = delete_chunks_by_document(document_id)

    # 3. Delete uploaded file and extracted text file
    uploaded_file_deleted = delete_file_if_exists(document.get("file_path"))
    extracted_text_deleted = delete_file_if_exists(document.get("text_path"))

    # 4. Delete document record from PostgreSQL
    document_record_deleted = delete_document_record(document_id)

    cache_cleanup = delete_project_chat_cache(project_id)

    return {
        "message": "Document deleted successfully",
        "document_id": document_id,
        "project_id": project_id,
        "file_name": document.get("file_name"),
        "deleted_chunks_count": deleted_chunks_count,
        "vector_delete_result": vector_result,
        "uploaded_file_deleted": uploaded_file_deleted,
        "extracted_text_deleted": extracted_text_deleted,
        "document_record_deleted": document_record_deleted,
        "cache_cleanup": cache_cleanup
    }
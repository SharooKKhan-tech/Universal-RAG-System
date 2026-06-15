from pathlib import Path
from fastapi import HTTPException

from app.services.document_service import (
    get_document_by_id,
    load_documents,
    save_documents
)
from app.services.chunk_service import (
    get_chunks_by_document,
    load_chunks,
    save_chunks
)
from app.services.vector_service import delete_vectors_for_document


def delete_file_if_exists(file_path: str | None):
    if not file_path:
        return False

    path = Path(file_path)

    if path.exists():
        path.unlink()
        return True

    return False


def delete_document_completely(document_id: str):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    project_id = document["project_id"]

    # 1. Delete vectors from ChromaDB
    vector_result = delete_vectors_for_document(document_id)

    # 2. Delete chunks from chunks.json
    existing_chunks = get_chunks_by_document(document_id)

    all_chunks = load_chunks()
    remaining_chunks = [
        chunk for chunk in all_chunks
        if chunk["document_id"] != document_id
    ]

    save_chunks(remaining_chunks)

    # 3. Delete uploaded file and extracted text file
    uploaded_file_deleted = delete_file_if_exists(document.get("file_path"))
    extracted_text_deleted = delete_file_if_exists(document.get("text_path"))

    # 4. Delete document record from documents.json
    documents = load_documents()
    remaining_documents = [
        doc for doc in documents
        if doc["id"] != document_id
    ]

    save_documents(remaining_documents)

    return {
        "message": "Document deleted successfully",
        "document_id": document_id,
        "project_id": project_id,
        "file_name": document.get("file_name"),
        "deleted_chunks_count": len(existing_chunks),
        "vector_delete_result": vector_result,
        "uploaded_file_deleted": uploaded_file_deleted,
        "extracted_text_deleted": extracted_text_deleted
    }
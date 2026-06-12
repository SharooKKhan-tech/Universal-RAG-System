import json
from uuid import uuid4
from pathlib import Path
from datetime import datetime
from fastapi import HTTPException

from app.services.document_service import get_document_by_id, load_documents, save_documents
from app.ingestion.chunker import split_text_into_chunks

DATA_DIR = Path("data")
CHUNKS_FILE = DATA_DIR / "chunks.json"


def ensure_chunk_storage_exists():
    DATA_DIR.mkdir(exist_ok=True)

    if not CHUNKS_FILE.exists():
        CHUNKS_FILE.write_text("[]", encoding="utf-8")


def load_chunks():
    ensure_chunk_storage_exists()

    with open(CHUNKS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def save_chunks(chunks):
    ensure_chunk_storage_exists()

    with open(CHUNKS_FILE, "w", encoding="utf-8") as file:
        json.dump(chunks, file, indent=4)


def update_document_status(document_id: str, status: str, error_message=None):
    documents = load_documents()

    for index, document in enumerate(documents):
        if document["id"] == document_id:
            documents[index]["status"] = status
            documents[index]["error_message"] = error_message
            save_documents(documents)
            return documents[index]

    return None


def chunk_document(document_id: str):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document["status"] != "text_extracted":
        raise HTTPException(
            status_code=400,
            detail=f"Document is not ready for chunking. Current status: {document['status']}"
        )

    text_path = document.get("text_path")

    if not text_path or not Path(text_path).exists():
        raise HTTPException(status_code=404, detail="Extracted text file not found")

    try:
        update_document_status(document_id, "chunking")

        extracted_text = Path(text_path).read_text(
            encoding="utf-8",
            errors="ignore"
        )

        generated_chunks = split_text_into_chunks(extracted_text)

        if not generated_chunks:
            raise ValueError("No chunks generated from document")

        all_chunks = load_chunks()

        # Remove old chunks for this document if re-chunking
        all_chunks = [
            chunk for chunk in all_chunks
            if chunk["document_id"] != document_id
        ]

        new_chunk_records = []

        for chunk in generated_chunks:
            chunk_record = {
                "id": str(uuid4()),
                "project_id": document["project_id"],
                "document_id": document_id,
                "chunk_text": chunk["chunk_text"],
                "chunk_index": chunk["chunk_index"],
                "page_number": chunk["page_number"],
                "created_at": datetime.utcnow().isoformat()
            }

            new_chunk_records.append(chunk_record)

        all_chunks.extend(new_chunk_records)
        save_chunks(all_chunks)

        update_document_status(document_id, "chunked")

        return {
            "message": "Document chunked successfully",
            "document_id": document_id,
            "total_chunks": len(new_chunk_records),
            "chunks": new_chunk_records
        }

    except Exception as error:
        update_document_status(document_id, "failed", str(error))

        raise HTTPException(
            status_code=500,
            detail=f"Chunking failed: {str(error)}"
        )


def get_chunks_by_document(document_id: str):
    chunks = load_chunks()

    return [
        chunk for chunk in chunks
        if chunk["document_id"] == document_id
    ]


def get_chunks_by_project(project_id: str):
    chunks = load_chunks()

    return [
        chunk for chunk in chunks
        if chunk["project_id"] == project_id
    ]
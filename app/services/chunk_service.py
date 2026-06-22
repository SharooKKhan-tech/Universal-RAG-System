import json
from uuid import uuid4
from datetime import datetime
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy import select, delete

from app.db.models import Document, Chunk
from app.db.sync_database import SessionLocal
from app.ingestion.chunker import split_text_into_chunks
from app.services.document_service import get_document_by_id, update_document_status


def chunk_to_dict(chunk: Chunk):
    return {
        "id": chunk.id,
        "project_id": chunk.project_id,
        "document_id": chunk.document_id,
        "chunk_text": chunk.chunk_text,
        "chunk_index": chunk.chunk_index,
        "page_number": chunk.page_number,
        "vector_id": chunk.vector_id,
        "created_at": chunk.created_at
    }


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

        with SessionLocal() as db:
            # remove old chunks if re-chunking
            db.execute(
                delete(Chunk).where(Chunk.document_id == document_id)
            )

            new_chunk_records = []

            for chunk in generated_chunks:
                chunk_text_with_prefix = f"Document: {document['file_name']}\n\n{chunk['chunk_text']}"
                chunk_record = Chunk(
                    id=str(uuid4()),
                    project_id=document["project_id"],
                    document_id=document_id,
                    chunk_text=chunk_text_with_prefix,
                    chunk_index=chunk["chunk_index"],
                    page_number=chunk["page_number"],
                    vector_id=None,
                    created_at=datetime.utcnow()
                )

                db.add(chunk_record)
                new_chunk_records.append(chunk_record)

            db.commit()

            for chunk_record in new_chunk_records:
                db.refresh(chunk_record)

            result_chunks = [
                chunk_to_dict(chunk_record)
                for chunk_record in new_chunk_records
            ]

        update_document_status(document_id, "chunked")

        return {
            "message": "Document chunked successfully",
            "document_id": document_id,
            "total_chunks": len(result_chunks),
            "chunks": result_chunks
        }

    except Exception as error:
        update_document_status(document_id, "failed", str(error))

        raise HTTPException(
            status_code=500,
            detail=f"Chunking failed: {str(error)}"
        )


def get_chunks_by_document(document_id: str):
    with SessionLocal() as db:
        result = db.execute(
            select(Chunk)
            .where(Chunk.document_id == document_id)
            .order_by(Chunk.chunk_index.asc())
        )

        chunks = result.scalars().all()

        return [
            chunk_to_dict(chunk)
            for chunk in chunks
        ]


def get_chunks_by_project(project_id: str):
    with SessionLocal() as db:
        result = db.execute(
            select(Chunk)
            .where(Chunk.project_id == project_id)
            .order_by(Chunk.created_at.desc())
        )

        chunks = result.scalars().all()

        return [
            chunk_to_dict(chunk)
            for chunk in chunks
        ]


def delete_chunks_by_document(document_id: str):
    with SessionLocal() as db:
        existing_chunks = db.execute(
            select(Chunk).where(Chunk.document_id == document_id)
        ).scalars().all()

        deleted_count = len(existing_chunks)

        db.execute(
            delete(Chunk).where(Chunk.document_id == document_id)
        )

        db.commit()

        return deleted_count
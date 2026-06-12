from fastapi import APIRouter
from app.services.chunk_service import (
    chunk_document,
    get_chunks_by_document,
    get_chunks_by_project
)

router = APIRouter()


@router.post("/chunks/{document_id}")
def create_chunks_for_document(document_id: str):
    return chunk_document(document_id)


@router.get("/chunks/document/{document_id}")
def list_document_chunks(document_id: str):
    return get_chunks_by_document(document_id)


@router.get("/chunks/project/{project_id}")
def list_project_chunks(project_id: str):
    return get_chunks_by_project(project_id)
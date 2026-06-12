from fastapi import APIRouter, Depends, HTTPException

from app.services.chunk_service import (
    chunk_document,
    get_chunks_by_document,
    get_chunks_by_project
)
from app.services.document_service import get_document_by_id
from app.core.security import verify_api_key, ensure_project_access

router = APIRouter()


@router.post("/chunks/{document_id}")
def create_chunks_for_document(
    document_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    ensure_project_access(api_key_record, document["project_id"])

    return chunk_document(document_id)


@router.get("/chunks/document/{document_id}")
def list_document_chunks(
    document_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    ensure_project_access(api_key_record, document["project_id"])

    return get_chunks_by_document(document_id)


@router.get("/chunks/project/{project_id}")
def list_project_chunks(
    project_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return get_chunks_by_project(project_id)
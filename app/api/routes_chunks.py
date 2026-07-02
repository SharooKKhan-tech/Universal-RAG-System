from fastapi import APIRouter, Depends, HTTPException

from app.services.chunk_service import (
    chunk_document,
    get_chunks_by_document,
    get_chunks_by_project
)
from app.services.document_service import get_document_by_id
from app.api.routes_documents import flexible_auth, check_flexible_project_access

router = APIRouter()


@router.post("/chunks/{document_id}")
def create_chunks_for_document(
    document_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    check_flexible_project_access(auth_ctx, document["project_id"])

    return chunk_document(document_id)


@router.get("/chunks/document/{document_id}")
def list_document_chunks(
    document_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    check_flexible_project_access(auth_ctx, document["project_id"])

    return get_chunks_by_document(document_id)


@router.get("/chunks/project/{project_id}")
def list_project_chunks(
    project_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)

    return get_chunks_by_project(project_id)
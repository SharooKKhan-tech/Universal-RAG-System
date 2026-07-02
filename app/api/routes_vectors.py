from fastapi import APIRouter, Depends, HTTPException

from app.db.schemas import SearchRequest
from app.services.vector_service import (
    index_document_chunks,
    retrieve_chunks
)
from app.services.document_service import get_document_by_id
from app.api.routes_documents import flexible_auth, check_flexible_project_access

router = APIRouter()


@router.post("/index/{document_id}")
def index_document(
    document_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    check_flexible_project_access(auth_ctx, document["project_id"])

    return index_document_chunks(document_id)


@router.post("/search")
def search_vectors(
    request: SearchRequest,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, request.project_id)

    return retrieve_chunks(
        project_id=request.project_id,
        query=request.query,
        top_k=request.top_k,
        retrieval_mode=request.retrieval_mode,
        rerank=request.rerank
    )
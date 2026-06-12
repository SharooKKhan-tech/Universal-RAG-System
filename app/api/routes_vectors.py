from fastapi import APIRouter, Depends, HTTPException

from app.db.schemas import SearchRequest
from app.services.vector_service import (
    index_document_chunks,
    semantic_search
)
from app.services.document_service import get_document_by_id
from app.core.security import verify_api_key, ensure_project_access

router = APIRouter()


@router.post("/index/{document_id}")
def index_document(
    document_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    ensure_project_access(api_key_record, document["project_id"])

    return index_document_chunks(document_id)


@router.post("/search")
def search_vectors(
    request: SearchRequest,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, request.project_id)

    return semantic_search(
        project_id=request.project_id,
        query=request.query,
        top_k=request.top_k
    )
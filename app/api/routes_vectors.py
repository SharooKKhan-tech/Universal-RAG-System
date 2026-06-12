from fastapi import APIRouter
from app.db.schemas import SearchRequest
from app.services.vector_service import (
    index_document_chunks,
    semantic_search
)

router = APIRouter()


@router.post("/index/{document_id}")
def index_document(document_id: str):
    return index_document_chunks(document_id)


@router.post("/search")
def search_vectors(request: SearchRequest):
    return semantic_search(
        project_id=request.project_id,
        query=request.query,
        top_k=request.top_k
    )
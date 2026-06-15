from fastapi import APIRouter, Depends

from app.db.schemas import ChatRequest
from app.services.chat_service import (
    answer_question,
    get_queries_by_project
)
from app.core.security import verify_api_key, ensure_project_access

router = APIRouter()


@router.post("/chat")
def chat_with_documents(
    request: ChatRequest,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, request.project_id)

    return answer_question(
        project_id=request.project_id,
        question=request.question,
        top_k=request.top_k,
        rewrite_enabled=request.rewrite_query,
        retrieval_mode=request.retrieval_mode,
        rerank=request.rerank
    )


@router.get("/queries/{project_id}")
def list_project_queries(
    project_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return get_queries_by_project(project_id)
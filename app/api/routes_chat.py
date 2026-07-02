from fastapi import APIRouter, Depends

from app.db.schemas import ChatRequest
from app.services.chat_service import (
    answer_question,
    get_queries_by_project
)
from app.api.routes_documents import flexible_auth, check_flexible_project_access

router = APIRouter()


@router.post("/chat")
def chat_with_documents(
    request: ChatRequest,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, request.project_id)

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
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)

    return get_queries_by_project(project_id)
from fastapi import APIRouter
from app.db.schemas import ChatRequest
from app.services.chat_service import (
    answer_question,
    get_queries_by_project
)

router = APIRouter()


@router.post("/chat")
def chat_with_documents(request: ChatRequest):
    return answer_question(
        project_id=request.project_id,
        question=request.question,
        top_k=request.top_k
    )


@router.get("/queries/{project_id}")
def list_project_queries(project_id: str):
    return get_queries_by_project(project_id)
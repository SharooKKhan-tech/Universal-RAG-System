from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.retrieval.query_rewriter import rewrite_query
from app.api.routes_documents import flexible_auth

router = APIRouter()


class QueryRewriteRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)
    force: bool = True


@router.post("/query/rewrite")
def rewrite_user_query(
    request: QueryRewriteRequest,
    auth_ctx: dict = Depends(flexible_auth)
):
    # This endpoint doesn't check project access since it only rewrites text
    return rewrite_query(
        question=request.question,
        force=request.force
    )
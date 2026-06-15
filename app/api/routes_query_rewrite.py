from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.security import verify_api_key
from app.retrieval.query_rewriter import rewrite_query

router = APIRouter()


class QueryRewriteRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)
    force: bool = True


@router.post("/query/rewrite")
def rewrite_user_query(
    request: QueryRewriteRequest,
    api_key_record: dict = Depends(verify_api_key)
):
    return rewrite_query(
        question=request.question,
        force=request.force
    )
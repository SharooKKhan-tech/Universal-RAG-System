from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal, List


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: datetime

class DocumentResponse(BaseModel):
    id: str
    project_id: str
    file_name: str
    file_type: str
    file_path: str
    text_path: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime

class ChunkResponse(BaseModel):
    id: str
    project_id: str
    document_id: str
    chunk_text: str
    chunk_index: int
    page_number: Optional[int] = None
    created_at: datetime

class SearchRequest(BaseModel):
    project_id: str
    query: str = Field(..., min_length=2, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=20)
    retrieval_mode: Literal["semantic", "keyword", "hybrid"] = "hybrid"
    rerank: bool = Field(default=True)

class ChatRequest(BaseModel):
    project_id: str
    question: str = Field(..., min_length=2, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=20)
    rewrite_query: bool = Field(default=True)
    retrieval_mode: Literal["semantic", "keyword", "hybrid"] = "hybrid"
    rerank: bool = Field(default=True) 

class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)


class ApiKeyResponse(BaseModel):
    id: str
    project_id: str
    name: str
    api_key: str
    is_active: bool
    created_at: datetime

class EvaluationTestCaseCreate(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)
    expected_answer_keywords: List[str] = Field(default_factory=list)
    expected_source_file: Optional[str] = None
    expected_should_answer: bool = True
    top_k: int = Field(default=3, ge=1, le=20)
    rewrite_query: bool = True
    retrieval_mode: Literal["semantic", "keyword", "hybrid"] = "hybrid"
    rerank: bool = True
    notes: Optional[str] = None


class EvaluationRunRequest(BaseModel):
    test_case_ids: Optional[List[str]] = None
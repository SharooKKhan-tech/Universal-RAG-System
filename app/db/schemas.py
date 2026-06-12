from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


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

class ChatRequest(BaseModel):
    project_id: str
    question: str = Field(..., min_length=2, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=20)
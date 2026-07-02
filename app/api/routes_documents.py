from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query, Header, Request
from typing import Optional

from app.db.schemas import DocumentResponse
from app.services.document_service import (
    upload_and_process_document,
    get_documents_by_project,
    get_document_by_id
)
from app.services.pipeline_service import upload_chunk_and_index_document
from app.services.document_management_service import delete_document_completely
from app.services.vector_service import reindex_document_chunks
from app.core.security import ensure_project_access
from app.services.api_key_service import get_api_key_record
from app.core.auth import get_user_from_token, check_project_access as jwt_check_project_access
from app.services.rate_limit_service import check_rate_limit
from fastapi import BackgroundTasks
from app.services.background_pipeline_service import (
    upload_document_for_background_processing,
    process_document_in_background
)

router = APIRouter()


def flexible_auth(
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    """
    Accepts either an X-API-Key header (for external API use)
    or an Authorization: Bearer <token> header (for dashboard users).
    Returns a unified auth context dict.
    """
    # --- Try API Key first ---
    if x_api_key:
        record = get_api_key_record(x_api_key)
        if not record:
            raise HTTPException(status_code=401, detail="Invalid or missing API key")
        check_rate_limit(record)
        return {"type": "api_key", "project_id": record["project_id"], "record": record}

    # --- Try JWT Bearer token ---
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        user = get_user_from_token(token)
        return {"type": "jwt", "user": user}

    raise HTTPException(status_code=401, detail="Authentication required: provide X-API-Key or Bearer token")


def check_flexible_project_access(auth_ctx: dict, project_id: str):
    """Verify the authenticated caller has access to the given project."""
    if auth_ctx["type"] == "api_key":
        ensure_project_access(auth_ctx["record"], project_id)
    elif auth_ctx["type"] == "jwt":
        jwt_check_project_access(auth_ctx["user"], project_id)


@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)
    return await upload_and_process_document(project_id, file)


@router.post("/documents/upload-and-index")
async def upload_and_index_document(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)
    return await upload_chunk_and_index_document(project_id, file)


@router.get("/documents/{project_id}")
def list_project_documents(
    project_id: str,
    status: str | None = Query(default=None),
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)
    return get_documents_by_project(project_id, status=status)


@router.get("/documents/status/{document_id}")
def document_status(
    document_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    document = get_document_by_id(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    check_flexible_project_access(auth_ctx, document["project_id"])
    return document


@router.post("/documents/reindex/{document_id}")
def reindex_document(
    document_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    document = get_document_by_id(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    check_flexible_project_access(auth_ctx, document["project_id"])
    return reindex_document_chunks(document_id)


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    document = get_document_by_id(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    check_flexible_project_access(auth_ctx, document["project_id"])
    return delete_document_completely(document_id)


@router.post("/documents/upload-background")
async def upload_document_background(
    background_tasks: BackgroundTasks,
    project_id: str = Form(...),
    file: UploadFile = File(...),
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)
    result = await upload_document_for_background_processing(
        project_id=project_id,
        file=file
    )
    background_tasks.add_task(
        process_document_in_background,
        result["document_id"]
    )
    return result
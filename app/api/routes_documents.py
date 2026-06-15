from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query

from app.db.schemas import DocumentResponse
from app.services.document_service import (
    upload_and_process_document,
    get_documents_by_project,
    get_document_by_id
)
from app.services.pipeline_service import upload_chunk_and_index_document
from app.services.document_management_service import delete_document_completely
from app.services.vector_service import reindex_document_chunks
from app.core.security import verify_api_key, ensure_project_access

router = APIRouter()


@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return await upload_and_process_document(project_id, file)


@router.post("/documents/upload-and-index")
async def upload_and_index_document(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return await upload_chunk_and_index_document(project_id, file)


@router.get("/documents/{project_id}")
def list_project_documents(
    project_id: str,
    status: str | None = Query(default=None),
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return get_documents_by_project(project_id, status=status)


@router.get("/documents/status/{document_id}")
def document_status(
    document_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    ensure_project_access(api_key_record, document["project_id"])

    return document


@router.post("/documents/reindex/{document_id}")
def reindex_document(
    document_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    ensure_project_access(api_key_record, document["project_id"])

    return reindex_document_chunks(document_id)


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    ensure_project_access(api_key_record, document["project_id"])

    return delete_document_completely(document_id)
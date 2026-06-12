from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.db.schemas import DocumentResponse
from app.services.document_service import (
    upload_and_process_document,
    get_documents_by_project,
    get_document_by_id
)

router = APIRouter()


@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    project_id: str = Form(...),
    file: UploadFile = File(...)
):
    return await upload_and_process_document(project_id, file)


@router.get("/documents/{project_id}")
def list_project_documents(project_id: str):
    return get_documents_by_project(project_id)


@router.get("/documents/status/{document_id}")
def document_status(document_id: str):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return document
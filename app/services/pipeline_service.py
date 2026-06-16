from fastapi import UploadFile, HTTPException
from app.services.cache_service import delete_project_chat_cache
from app.services.document_service import (
    upload_and_process_document,
    get_document_by_id
)
from app.services.chunk_service import chunk_document
from app.services.vector_service import index_document_chunks


async def upload_chunk_and_index_document(project_id: str, file: UploadFile):
    """
    Full automatic document pipeline:
    Upload -> Extract Text -> Chunk -> Index
    """

    uploaded_document = await upload_and_process_document(
        project_id=project_id,
        file=file
    )

    document_id = uploaded_document["id"]

    if uploaded_document["status"] == "failed":
        return {
            "message": "Document upload/text extraction failed",
            "document_id": document_id,
            "status": "failed",
            "error_message": uploaded_document.get("error_message")
        }

    if uploaded_document["status"] != "text_extracted":
        raise HTTPException(
            status_code=400,
            detail=f"Document is not ready for chunking. Current status: {uploaded_document['status']}"
        )

    chunk_result = chunk_document(document_id)

    index_result = index_document_chunks(document_id)

    delete_project_chat_cache(project_id)

    final_document = get_document_by_id(document_id)

    return {
        "message": "Document uploaded, chunked, and indexed successfully",
        "document_id": document_id,
        "project_id": project_id,
        "file_name": uploaded_document["file_name"],
        "file_type": uploaded_document["file_type"],
        "status": final_document["status"] if final_document else "unknown",
        "text_path": uploaded_document.get("text_path"),
        "total_chunks": chunk_result.get("total_chunks"),
        "total_chunks_indexed": index_result.get("total_chunks_indexed")
    }
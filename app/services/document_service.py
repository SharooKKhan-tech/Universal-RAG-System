import json
import re
from uuid import uuid4
from pathlib import Path
from datetime import datetime
from fastapi import UploadFile, HTTPException

from app.services.project_service import get_project_by_id
from app.ingestion.loaders import extract_text_from_file

DATA_DIR = Path("data")
UPLOADS_DIR = Path("uploads")
EXTRACTED_TEXT_DIR = DATA_DIR / "extracted_text"
DOCUMENTS_FILE = DATA_DIR / "documents.json"

SUPPORTED_FILE_TYPES = {"pdf", "txt"}


def ensure_document_storage_exists():
    DATA_DIR.mkdir(exist_ok=True)
    UPLOADS_DIR.mkdir(exist_ok=True)
    EXTRACTED_TEXT_DIR.mkdir(exist_ok=True)

    if not DOCUMENTS_FILE.exists():
        DOCUMENTS_FILE.write_text("[]", encoding="utf-8")


def load_documents():
    ensure_document_storage_exists()

    with open(DOCUMENTS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def save_documents(documents):
    ensure_document_storage_exists()

    with open(DOCUMENTS_FILE, "w", encoding="utf-8") as file:
        json.dump(documents, file, indent=4)


def clean_filename(filename: str) -> str:
    filename = Path(filename).name
    filename = filename.replace(" ", "_")
    filename = re.sub(r"[^a-zA-Z0-9_.-]", "", filename)
    return filename


async def upload_and_process_document(project_id: str, file: UploadFile):
    project = get_project_by_id(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    original_filename = clean_filename(file.filename)
    file_extension = Path(original_filename).suffix.lower().replace(".", "")

    if file_extension not in SUPPORTED_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and TXT files are supported in Version 1"
        )

    document_id = str(uuid4())

    project_upload_dir = UPLOADS_DIR / project_id
    project_upload_dir.mkdir(parents=True, exist_ok=True)

    stored_file_path = project_upload_dir / f"{document_id}_{original_filename}"

    file_bytes = await file.read()
    stored_file_path.write_bytes(file_bytes)

    document_record = {
        "id": document_id,
        "project_id": project_id,
        "file_name": original_filename,
        "file_type": file_extension,
        "file_path": str(stored_file_path),
        "text_path": None,
        "status": "processing",
        "error_message": None,
        "created_at": datetime.utcnow().isoformat()
    }

    documents = load_documents()
    documents.append(document_record)
    save_documents(documents)

    try:
        extracted_text = extract_text_from_file(
            file_path=str(stored_file_path),
            file_type=file_extension
        )

        if not extracted_text.strip():
            raise ValueError("No readable text found in document")

        text_file_path = EXTRACTED_TEXT_DIR / f"{document_id}.txt"
        text_file_path.write_text(
            extracted_text,
            encoding="utf-8",
            errors="ignore"
        )

        document_record["text_path"] = str(text_file_path)
        document_record["status"] = "text_extracted"

    except Exception as error:
        document_record["status"] = "failed"
        document_record["error_message"] = str(error)

    documents = load_documents()

    for index, document in enumerate(documents):
        if document["id"] == document_id:
            documents[index] = document_record
            break

    save_documents(documents)

    return document_record


def get_documents_by_project(project_id: str, status: str | None = None):
    documents = load_documents()

    project_documents = [
        document for document in documents
        if document["project_id"] == project_id
    ]

    if status:
        project_documents = [
            document for document in project_documents
            if document.get("status") == status
        ]

    return project_documents


def get_document_by_id(document_id: str):
    documents = load_documents()

    for document in documents:
        if document["id"] == document_id:
            return document

    return None
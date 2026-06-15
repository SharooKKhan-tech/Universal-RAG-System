import shutil
from pathlib import Path
from fastapi import HTTPException

from app.services.project_service import (
    get_project_by_id,
    load_projects,
    save_projects
)
from app.services.document_service import get_documents_by_project
from app.services.document_management_service import delete_document_completely
from app.services.api_key_service import delete_api_keys_by_project
from app.services.chat_service import delete_queries_by_project

UPLOADS_DIR = Path("uploads")


def delete_project_upload_folder(project_id: str):
    project_upload_folder = UPLOADS_DIR / project_id

    if project_upload_folder.exists():
        shutil.rmtree(project_upload_folder)
        return True

    return False


def delete_project_record(project_id: str):
    projects = load_projects()

    remaining_projects = [
        project for project in projects
        if project["id"] != project_id
    ]

    deleted_count = len(projects) - len(remaining_projects)

    save_projects(remaining_projects)

    return {
        "deleted_count": deleted_count
    }


def delete_project_completely(project_id: str):
    project = get_project_by_id(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 1. Delete all documents under this project
    project_documents = get_documents_by_project(project_id)

    deleted_documents = []

    for document in project_documents:
        result = delete_document_completely(document["id"])
        deleted_documents.append(result)

    # 2. Delete API keys
    api_key_result = delete_api_keys_by_project(project_id)

    # 3. Delete query history
    query_result = delete_queries_by_project(project_id)

    # 4. Delete project upload folder if still exists
    upload_folder_deleted = delete_project_upload_folder(project_id)

    # 5. Delete project record
    project_record_result = delete_project_record(project_id)

    return {
        "message": "Project deleted completely",
        "project_id": project_id,
        "project_name": project.get("name"),
        "deleted_documents_count": len(deleted_documents),
        "deleted_documents": deleted_documents,
        "api_key_cleanup": api_key_result,
        "query_cleanup": query_result,
        "upload_folder_deleted": upload_folder_deleted,
        "project_record_deleted": project_record_result["deleted_count"] == 1
    }
from fastapi import APIRouter, Depends

from app.core.security import verify_api_key, ensure_project_access
from app.services.analytics_service import (
    calculate_project_analytics,
    get_document_usage
)

router = APIRouter()


@router.get("/analytics/{project_id}")
def project_analytics(
    project_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return calculate_project_analytics(project_id)


@router.get("/analytics/{project_id}/documents")
def project_document_usage(
    project_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return get_document_usage(project_id)
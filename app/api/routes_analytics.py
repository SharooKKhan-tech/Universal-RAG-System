from fastapi import APIRouter, Depends

from app.services.analytics_service import (
    calculate_project_analytics,
    get_document_usage
)
from app.api.routes_documents import flexible_auth, check_flexible_project_access

router = APIRouter()


@router.get("/analytics/{project_id}")
def project_analytics(
    project_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)
    return calculate_project_analytics(project_id)


@router.get("/analytics/{project_id}/documents")
def project_document_usage(
    project_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)
    return get_document_usage(project_id)
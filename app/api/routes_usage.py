from fastapi import APIRouter, Depends

from app.services.monitoring_service import get_project_usage_summary
from app.api.routes_documents import flexible_auth, check_flexible_project_access

router = APIRouter()


@router.get("/usage/{project_id}")
def project_usage_summary(
    project_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)

    return get_project_usage_summary(project_id)
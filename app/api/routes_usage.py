from fastapi import APIRouter, Depends

from app.core.security import verify_api_key, ensure_project_access
from app.services.monitoring_service import get_project_usage_summary

router = APIRouter()


@router.get("/usage/{project_id}")
def project_usage_summary(
    project_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return get_project_usage_summary(project_id)
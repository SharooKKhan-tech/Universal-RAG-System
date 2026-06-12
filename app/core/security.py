from fastapi import Header, HTTPException

from app.services.api_key_service import get_api_key_record


def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    api_key_record = get_api_key_record(x_api_key)

    if not api_key_record:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key"
        )

    return api_key_record


def ensure_project_access(api_key_record: dict, project_id: str):
    if api_key_record["project_id"] != project_id:
        raise HTTPException(
            status_code=403,
            detail="API key does not have access to this project"
        )

    return True
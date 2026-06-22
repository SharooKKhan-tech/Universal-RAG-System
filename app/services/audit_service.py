from uuid import uuid4
from datetime import datetime
from fastapi import Request
from typing import Optional, Any

from app.db.models import AuditLog
from app.db.sync_database import SessionLocal

def log_audit_action(
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    client_id: Optional[str] = None,
    project_id: Optional[str] = None,
    user_id: Optional[str] = None,
    api_key_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata_json: Optional[Any] = None
):
    """
    Asynchronously or synchronously writes an audit log entry to the database.
    """
    with SessionLocal() as db:
        new_log = AuditLog(
            id=str(uuid4()),
            client_id=client_id,
            project_id=project_id,
            user_id=user_id,
            api_key_id=api_key_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata_json=metadata_json,
            created_at=datetime.utcnow()
        )
        db.add(new_log)
        db.commit()
        return new_log

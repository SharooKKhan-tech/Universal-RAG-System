from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime

from app.core.auth import get_current_user, check_project_access
from app.db.models import AuditLog, User
from app.db.sync_database import SessionLocal

router = APIRouter()

@router.get("/audit-logs")
def list_audit_logs(
    project_id: Optional[str] = None,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    SUPER_ADMIN gets all logs.
    CLIENT_ADMIN gets client company logs.
    PROJECT_ADMIN/DEVELOPER/VIEWER can filter by their assigned project.
    """
    with SessionLocal() as db:
        query = select(AuditLog)
        filters = []
        
        # Enforce scoping by user role
        if current_user.role == "SUPER_ADMIN":
            pass
        elif current_user.role == "CLIENT_ADMIN":
            if not current_user.client_id:
                raise HTTPException(status_code=400, detail="User not associated with a client")
            filters.append(AuditLog.client_id == current_user.client_id)
        else:
            # For other roles, they must specify a project they have access to
            if not project_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Please specify project_id to filter audit logs"
                )
            # Check project access
            check_project_access(current_user, project_id)
            filters.append(AuditLog.project_id == project_id)
        
        # Additional user filters
        if project_id:
            # Double check project access if CLIENT_ADMIN or SUPER_ADMIN
            if current_user.role != "SUPER_ADMIN" and current_user.role != "CLIENT_ADMIN":
                pass # Already verified above
            else:
                # Still check access to project_id if they passed it
                check_project_access(current_user, project_id)
            filters.append(AuditLog.project_id == project_id)
            
        if user_id:
            filters.append(AuditLog.user_id == user_id)
            
        if action:
            filters.append(AuditLog.action == action)
            
        if from_date:
            try:
                dt_from = datetime.fromisoformat(from_date)
                filters.append(AuditLog.created_at >= dt_from)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid from_date format. Use ISO format.")
                
        if to_date:
            try:
                dt_to = datetime.fromisoformat(to_date)
                filters.append(AuditLog.created_at <= dt_to)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid to_date format. Use ISO format.")
        
        if filters:
            query = query.where(and_(*filters))
            
        query = query.order_by(AuditLog.created_at.desc())
        result = db.execute(query)
        logs = result.scalars().all()
        
        return [
            {
                "id": log.id,
                "client_id": log.client_id,
                "project_id": log.project_id,
                "user_id": log.user_id,
                "api_key_id": log.api_key_id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "metadata": log.metadata_json,
                "created_at": log.created_at
            } for log in logs
        ]

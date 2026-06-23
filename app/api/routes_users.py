from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from typing import List

from app.core.auth import get_current_user, require_role, get_password_hash
from app.db.models import User, ProjectMembership, Project
from app.db.schemas import UserInvite, UserResponse
from app.db.sync_database import SessionLocal
from app.services.audit_service import log_audit_action

router = APIRouter()

@router.post("/users/invite")
def invite_user(
    request: UserInvite,
    req: Request,
    current_user: User = Depends(require_role(["CLIENT_ADMIN"]))
):
    """
    CLIENT_ADMIN only: invite a user to join the company.
    """
    if not current_user.client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current user not associated with a client"
        )
    
    with SessionLocal() as db:
        # Check if user already exists
        existing_user = db.execute(
            select(User).where(User.email == request.email)
        ).scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        # Create user
        user_id = str(uuid4())
        # Default hashed password
        default_pwd = get_password_hash("password")
        
        new_user = User(
            id=user_id,
            client_id=current_user.client_id,
            name=request.name,
            email=request.email,
            hashed_password=default_pwd,
            role=request.role,
            is_active=True
        )
        db.add(new_user)
        
        # Add project memberships
        if request.project_ids:
            for pid in request.project_ids:
                # check project belongs to client
                proj = db.get(Project, pid)
                if proj and proj.client_id == current_user.client_id:
                    membership = ProjectMembership(
                        id=str(uuid4()),
                        project_id=pid,
                        user_id=user_id,
                        role=request.role
                    )
                    db.add(membership)
        
        db.commit()
        
        # Log audit action
        log_audit_action(
            action="user.invite",
            resource_type="user",
            resource_id=user_id,
            client_id=current_user.client_id,
            user_id=current_user.id,
            ip_address=req.client.host if req.client else None,
            user_agent=req.headers.get("user-agent"),
            metadata_json={"role": request.role, "email": request.email}
        )
        
        return {
            "message": "User invited successfully",
            "user_id": user_id,
            "email": request.email,
            "role": request.role
        }

@router.get("/users", response_model=List[UserResponse])
def list_users(current_user: User = Depends(get_current_user)):
    """
    CLIENT_ADMIN sees company users. SUPER_ADMIN sees all.
    """
    with SessionLocal() as db:
        if current_user.role == "SUPER_ADMIN":
            result = db.execute(select(User).order_by(User.created_at.desc()))
        else:
            if not current_user.client_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is not associated with a client company"
                )
            result = db.execute(
                select(User)
                .where(User.client_id == current_user.client_id)
                .order_by(User.created_at.desc())
            )
        users = result.scalars().all()
        # Expunge from session before returning
        for u in users:
            db.expunge(u)
        return users

@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    role: str,
    req: Request,
    current_user: User = Depends(require_role(["CLIENT_ADMIN"]))
):
    """
    CLIENT_ADMIN or SUPER_ADMIN: update user role.
    """
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        if role not in ["SUPER_ADMIN", "CLIENT_ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role: must be SUPER_ADMIN or CLIENT_ADMIN"
            )
        
        # Check authorization
        if current_user.role != "SUPER_ADMIN" and user.client_id != current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this user"
            )
        
        old_role = user.role
        user.role = role
        db.commit()
        
        # Log audit
        log_audit_action(
            action="user.role_update",
            resource_type="user",
            resource_id=user_id,
            client_id=current_user.client_id,
            user_id=current_user.id,
            ip_address=req.client.host if req.client else None,
            user_agent=req.headers.get("user-agent"),
            metadata_json={"old_role": old_role, "new_role": role}
        )
        
        return {
            "message": "User role updated successfully",
            "user_id": user_id,
            "role": role
        }

@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    is_active: bool,
    current_user: User = Depends(require_role(["CLIENT_ADMIN"]))
):
    """
    CLIENT_ADMIN or SUPER_ADMIN: update active status.
    """
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if current_user.role != "SUPER_ADMIN" and user.client_id != current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this user"
            )
        
        user.is_active = is_active
        db.commit()
        return {
            "message": "User status updated successfully",
            "user_id": user_id,
            "is_active": is_active
        }

@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    current_user: User = Depends(require_role(["CLIENT_ADMIN"]))
):
    """
    Deactivates (soft deletes) user.
    """
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if current_user.role != "SUPER_ADMIN" and user.client_id != current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this user"
            )
        
        user.is_active = False
        db.commit()
        return {
            "message": "User deactivated successfully",
            "user_id": user_id
        }

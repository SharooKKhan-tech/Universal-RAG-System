from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select

from app.core.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user
)
from app.db.models import User, Client
from app.db.schemas import UserRegister, UserLogin, TokenResponse, UserResponse
from app.db.sync_database import SessionLocal
from app.services.audit_service import log_audit_action

router = APIRouter()

@router.post("/auth/register", response_model=TokenResponse)
def register_user(request: UserRegister, req: Request):
    with SessionLocal() as db:
        # Check if email already registered
        existing_user = db.execute(
            select(User).where(User.email == request.email)
        ).scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create client/company
        client_id = str(uuid4())
        new_client = Client(
            id=client_id,
            name=request.company_name,
            company_name=request.company_name,
            email=request.email,
            plan="free",
            status="active"
        )
        db.add(new_client)
        
        # Create user
        user_id = str(uuid4())
        new_user = User(
            id=user_id,
            client_id=client_id,
            name=request.name,
            email=request.email,
            hashed_password=get_password_hash(request.password),
            role="CLIENT_ADMIN",
            is_active=True
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Log audit action
        log_audit_action(
            action="user.register",
            resource_type="user",
            resource_id=user_id,
            client_id=client_id,
            user_id=user_id,
            ip_address=req.client.host if req.client else None,
            user_agent=req.headers.get("user-agent"),
            metadata_json={"company_name": request.company_name}
        )
        
        # Create JWT access token
        access_token = create_access_token(data={"sub": user_id})
        
        # expunge user to safely return
        db.expunge(new_user)
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": new_user
        }

@router.post("/auth/login", response_model=TokenResponse)
def login_user(request: UserLogin, req: Request):
    with SessionLocal() as db:
        user = db.execute(
            select(User).where(User.email == request.email)
        ).scalar_one_or_none()
        
        if not user or not verify_password(request.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user account"
            )
        
        # Log audit action
        log_audit_action(
            action="user.login",
            resource_type="user",
            resource_id=user.id,
            client_id=user.client_id,
            user_id=user.id,
            ip_address=req.client.host if req.client else None,
            user_agent=req.headers.get("user-agent")
        )
        
        access_token = create_access_token(data={"sub": user.id})
        db.expunge(user)
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }

@router.get("/auth/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/auth/logout")
def logout_user():
    return {"message": "Logged out successfully"}

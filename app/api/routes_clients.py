from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from typing import List

from app.core.auth import get_current_user, require_role
from app.db.models import Client, Project, User
from app.db.sync_database import SessionLocal

router = APIRouter()

@router.get("/clients")
def list_clients(current_user: User = Depends(require_role(["SUPER_ADMIN"]))):
    """
    SUPER_ADMIN only: list all clients.
    """
    with SessionLocal() as db:
        result = db.execute(select(Client).order_by(Client.created_at.desc()))
        clients = result.scalars().all()
        return [
            {
                "id": c.id,
                "name": c.name,
                "company_name": c.company_name,
                "email": c.email,
                "plan": c.plan,
                "status": c.status,
                "is_active": c.is_active,
                "created_at": c.created_at
            } for c in clients
        ]

@router.get("/clients/me")
def read_current_client(current_user: User = Depends(get_current_user)):
    """
    CLIENT_ADMIN and other client members: get client details.
    """
    if not current_user.client_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not associated with this user"
        )
    
    with SessionLocal() as db:
        client = db.get(Client, current_user.client_id)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client company not found"
            )
        return {
            "id": client.id,
            "name": client.name,
            "company_name": client.company_name,
            "email": client.email,
            "plan": client.plan,
            "status": client.status,
            "is_active": client.is_active,
            "created_at": client.created_at
        }

@router.put("/clients/me")
def update_current_client(
    name: str,
    company_name: str,
    email: str,
    current_user: User = Depends(require_role(["CLIENT_ADMIN"]))
):
    """
    CLIENT_ADMIN only: update client company details.
    """
    if not current_user.client_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not associated with this user"
        )
    
    with SessionLocal() as db:
        client = db.get(Client, current_user.client_id)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client company not found"
            )
        client.name = name
        client.company_name = company_name
        client.email = email
        db.commit()
        return {
            "message": "Client updated successfully",
            "id": client.id,
            "name": client.name,
            "company_name": client.company_name
        }

@router.get("/clients/{client_id}/projects")
def list_client_projects(
    client_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    SUPER_ADMIN or users belonging to the specific client: list client's projects.
    """
    if current_user.role != "SUPER_ADMIN" and current_user.client_id != client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this client's projects"
        )
    
    with SessionLocal() as db:
        result = db.execute(
            select(Project)
            .where(Project.client_id == client_id)
            .order_by(Project.created_at.desc())
        )
        projects = result.scalars().all()
        return [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "created_at": p.created_at,
                "client_id": p.client_id
            } for p in projects
        ]

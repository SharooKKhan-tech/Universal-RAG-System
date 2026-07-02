from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.core.auth import get_current_user, check_project_access, require_project_permission
from app.core.config import settings
from app.core.key_rotator import gemini_key_rotator
from app.db.models import Project, LlmProviderConfig, User
from app.db.schemas import LlmConfigUpdate
from app.db.sync_database import SessionLocal

router = APIRouter()

@router.get("/llm/providers")
def list_providers(current_user: User = Depends(get_current_user)):
    """
    Returns the list of supported LLM providers and their configured status in environment.
    """
    return [
        {
            "name": "ollama",
            "display_name": "Ollama (Local)",
            "configured": True,  # local default is always active
            "default_model": settings.OLLAMA_MODEL
        },
        {
            "name": "openai",
            "display_name": "OpenAI Chat",
            "configured": bool(settings.OPENAI_API_KEY),
            "default_model": settings.OPENAI_MODEL
        },
        {
            "name": "gemini",
            "display_name": "Google Gemini",
            "configured": gemini_key_rotator.is_configured(),
            "default_model": settings.GEMINI_MODEL
        },
        {
            "name": "mock",
            "display_name": "Mock Provider (Testing)",
            "configured": True,
            "default_model": "mock-model"
        }
    ]

@router.post("/projects/{project_id}/llm-config")
def save_project_llm_config(
    project_id: str,
    request: LlmConfigUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Saves default LLM provider and model configurations for a specific project.
    Requires PROJECT_ADMIN or CLIENT_ADMIN or SUPER_ADMIN access.
    """
    # Enforce access permissions
    check_project_access(current_user, project_id)
    
    with SessionLocal() as db:
        project = db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        project.default_llm_provider = request.default_llm_provider
        project.default_model_name = request.default_model_name
        db.commit()
        
        return {
            "message": "Project LLM configuration saved successfully",
            "project_id": project_id,
            "default_llm_provider": project.default_llm_provider,
            "default_model_name": project.default_model_name
        }

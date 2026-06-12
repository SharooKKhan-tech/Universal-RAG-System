from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Universal RAG System",
        "version": "1.0.0"
    }


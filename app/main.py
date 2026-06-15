from fastapi import FastAPI
from app.api.routes_health import router as health_router
from app.api.routes_projects import router as projects_router
from app.api.routes_api_keys import router as api_keys_router
from app.api.routes_documents import router as documents_router
from app.api.routes_chunks import router as chunks_router
from app.api.routes_vectors import router as vectors_router
from app.api.routes_chat import router as chat_router
from app.api.routes_analytics import router as analytics_router
from app.api.routes_query_rewrite import router as query_rewrite_router
from app.api.routes_evaluations import router as evaluations_router
app = FastAPI(
    title="Universal RAG System",
    description="A reusable RAG backend platform for multiple applications",
    version="1.0.0"
)

app.include_router(health_router, prefix="/api/v1", tags=["Health"])
app.include_router(projects_router, prefix="/api/v1", tags=["Projects"])
app.include_router(api_keys_router, prefix="/api/v1", tags=["API Keys"])
app.include_router(documents_router, prefix="/api/v1", tags=["Documents"])
app.include_router(chunks_router, prefix="/api/v1", tags=["Chunks"])
app.include_router(vectors_router, prefix="/api/v1", tags=["Vector Store"])
app.include_router(chat_router, prefix="/api/v1", tags=["Chat"])
app.include_router(analytics_router, prefix="/api/v1", tags=["Analytics"])
app.include_router(query_rewrite_router, prefix="/api/v1", tags=["Query Rewriting"])
app.include_router(evaluations_router, prefix="/api/v1", tags=["Evaluations"])


@app.get("/")
def root():
    return {
        "message": "Welcome to Universal RAG System",
        "docs": "/docs"
    }
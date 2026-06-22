from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.api.routes_health import router as health_router
from app.api.routes_projects import router as projects_router
from app.api.routes_api_keys import router as api_keys_router
from app.api.routes_documents import router as documents_router
from app.api.routes_chunks import router as chunks_router
from app.api.routes_vectors import router as vectors_router
from app.api.routes_chat import router as chat_router
from app.api.routes_chat_stream import router as chat_stream_router
from app.api.routes_analytics import router as analytics_router
from app.api.routes_query_rewrite import router as query_rewrite_router
from app.api.routes_evaluations import router as evaluations_router
from app.api.routes_db_health import router as db_health_router
from app.api.routes_cache import router as cache_router
from app.api.routes_usage import router as usage_router
from app.api.routes_auth import router as auth_router
from app.api.routes_users import router as users_router
from app.api.routes_clients import router as clients_router
from app.api.routes_audit_logs import router as audit_logs_router
from app.api.routes_llm import router as llm_router
from app.api.routes_widget import router as widget_router

import time
from uuid import uuid4
from fastapi import Request
from app.services.api_key_service import get_api_key_record
from app.services.monitoring_service import log_api_usage

app = FastAPI(
    title="Universal RAG System",
    description="A reusable RAG backend platform for multiple applications",
    version="1.0.0"
)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "*",  # Needed for embedded widget on any domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve widget.js and widget-demo.html as static assets ──────────────────
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public")
if os.path.isdir(PUBLIC_DIR):
    app.mount("/public", StaticFiles(directory=PUBLIC_DIR), name="public")

@app.get("/widget.js", include_in_schema=False)
def serve_widget_js():
    path = os.path.join(PUBLIC_DIR, "widget.js")
    return FileResponse(path, media_type="application/javascript")

@app.get("/widget-demo", include_in_schema=False)
def serve_widget_demo():
    path = os.path.join(PUBLIC_DIR, "widget-demo.html")
    return FileResponse(path, media_type="text/html")
@app.middleware("http")
async def request_monitoring_middleware(request: Request, call_next):
    start_time = time.time()
    request_id = str(uuid4())

    response = None
    status_code = 500

    api_key_record = None
    api_key_value = request.headers.get("X-API-Key")

    if api_key_value:
        try:
            api_key_record = get_api_key_record(api_key_value)
        except Exception:
            api_key_record = None

    try:
        response = await call_next(request)
        status_code = response.status_code
        return response

    finally:
        latency_ms = int((time.time() - start_time) * 1000)

        project_id = None
        api_key_id = None

        if api_key_record:
            project_id = api_key_record.get("project_id")
            api_key_id = api_key_record.get("id")

        try:
            log_api_usage(
                method=request.method,
                path=request.url.path,
                status_code=status_code,
                latency_ms=latency_ms,
                request_id=request_id,
                project_id=project_id,
                api_key_id=api_key_id
            )
        except Exception:
            pass

        if response:
            response.headers["X-Request-ID"] = request_id
app.include_router(health_router, prefix="/api/v1", tags=["Health"])
app.include_router(auth_router, prefix="/api/v1", tags=["Auth"])
app.include_router(users_router, prefix="/api/v1", tags=["Users"])
app.include_router(clients_router, prefix="/api/v1", tags=["Clients"])
app.include_router(audit_logs_router, prefix="/api/v1", tags=["Audit Logs"])
app.include_router(llm_router, prefix="/api/v1", tags=["LLM Providers"])
app.include_router(projects_router, prefix="/api/v1", tags=["Projects"])
app.include_router(api_keys_router, prefix="/api/v1", tags=["API Keys"])
app.include_router(documents_router, prefix="/api/v1", tags=["Documents"])
app.include_router(chunks_router, prefix="/api/v1", tags=["Chunks"])
app.include_router(vectors_router, prefix="/api/v1", tags=["Vector Store"])
app.include_router(chat_router, prefix="/api/v1", tags=["Chat"])
app.include_router(chat_stream_router, prefix="/api/v1", tags=["Chat Streaming"])
app.include_router(widget_router, prefix="/api/v1", tags=["Widget"])
app.include_router(analytics_router, prefix="/api/v1", tags=["Analytics"])
app.include_router(query_rewrite_router, prefix="/api/v1", tags=["Query Rewriting"])
app.include_router(evaluations_router, prefix="/api/v1", tags=["Evaluations"])
app.include_router(db_health_router, prefix="/api/v1", tags=["Database"])
app.include_router(cache_router, prefix="/api/v1", tags=["Cache"])
app.include_router(usage_router, prefix="/api/v1", tags=["Usage"])


@app.get("/")
def root():
    return {
        "message": "Welcome to Universal RAG System",
        "docs": "/docs"
    }
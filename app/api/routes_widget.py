"""
Widget public-key routes.
These routes are accessible WITHOUT a secret project API key.
They use `widget_public_key` which is safe to embed in public websites.
"""
import json
import time
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse
from sqlalchemy import select
from typing import Optional

from app.db.models import WidgetConfig, Project
from app.db.sync_database import SessionLocal
from app.db.schemas import ChatRequest, WidgetConfigResponse, WidgetConfigUpdate
from app.core.auth import get_current_user, check_project_access
from app.db.models import User
from uuid import uuid4
from app.services.chat_service import answer_question, build_sources, build_context_from_results
from app.retrieval.confidence import NO_ANSWER_TEXT, filter_context_results, get_top_similarity_score, get_confidence_level, should_return_no_answer_before_llm
from app.services.vector_service import retrieve_chunks
from app.generation.prompts import build_rag_prompt
from app.retrieval.query_rewriter import rewrite_query
from app.services.chat_service import save_query_record
from pydantic import BaseModel


router = APIRouter()


class WidgetChatRequest(BaseModel):
    question: str
    top_k: int = 5
    rewrite_query: bool = True
    retrieval_mode: str = "hybrid"
    rerank: bool = True


def get_widget_config_by_key(widget_public_key: str) -> Optional[WidgetConfig]:
    """Resolve widget_public_key → WidgetConfig + Project, or raise 401."""
    with SessionLocal() as db:
        config = db.execute(
            select(WidgetConfig).where(
                WidgetConfig.widget_public_key == widget_public_key,
                WidgetConfig.is_enabled == True,
            )
        ).scalar_one_or_none()

        if not config:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or disabled widget public key",
            )
        db.expunge(config)
        return config


# ─── Public widget chat (non-streaming) ─────────────────────────────────────

@router.post("/widget/chat")
def widget_chat(
    body: WidgetChatRequest,
    x_widget_key: str = Header(..., alias="X-Widget-Key"),
):
    """
    Public chat endpoint authenticated with a widget public key.
    No secret API key required — safe to call from browser widgets.
    """
    config = get_widget_config_by_key(x_widget_key)

    result = answer_question(
        project_id=config.project_id,
        question=body.question,
        top_k=body.top_k,
        rewrite_enabled=body.rewrite_query,
        retrieval_mode=body.retrieval_mode,
        rerank=body.rerank,
    )
    return result


# ─── Public widget chat (streaming SSE) ─────────────────────────────────────

def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _stream_widget_chat(project_id: str, question: str, top_k: int, retrieval_mode: str, rerank: bool, rewrite_enabled: bool):
    import time as _time
    from app.services.cache_service import get_cached_answer, set_cached_answer
    from app.services.monitoring_service import estimate_tokens_from_text, estimate_llm_cost
    import requests as _requests

    start = _time.time()

    # Cache check
    cached = get_cached_answer(project_id=project_id, question=question, top_k=top_k)
    if cached:
        answer = cached.get("answer", "")
        for i, word in enumerate(answer.split(" ")):
            yield _sse("token", {"token": word if i == 0 else " " + word})
        yield _sse("done", {**cached, "cache_hit": True, "latency_ms": int((_time.time() - start) * 1000)})
        return

    # Rewrite
    retrieval_query = question
    if rewrite_enabled:
        rr = rewrite_query(question)
        retrieval_query = rr.get("rewritten_query", question)

    # Retrieve
    search_response = retrieve_chunks(project_id=project_id, query=retrieval_query, top_k=top_k, retrieval_mode=retrieval_mode, rerank=rerank)
    raw_results = search_response.get("results", [])
    retrieved_results = filter_context_results(results=raw_results, max_results=top_k)

    top_similarity_score = get_top_similarity_score(retrieved_results)
    confidence = get_confidence_level(top_similarity_score)
    sources = build_sources(retrieved_results)

    if not retrieved_results or should_return_no_answer_before_llm(top_similarity_score):
        latency_ms = int((_time.time() - start) * 1000)
        qr = save_query_record(project_id=project_id, question=question, answer=NO_ANSWER_TEXT, sources=[], latency_ms=latency_ms, model_name="phi3:mini", status="no_answer", confidence="low", top_similarity_score=top_similarity_score)
        yield _sse("token", {"token": NO_ANSWER_TEXT})
        yield _sse("done", {"answer": NO_ANSWER_TEXT, "sources": [], "confidence": "low", "status": "no_answer", "top_similarity_score": top_similarity_score, "latency_ms": latency_ms, "cache_hit": False, "query_id": qr["id"]})
        return

    context = build_context_from_results(retrieved_results)
    prompt = build_rag_prompt(question=question, context=context)

    # Stream from Ollama
    full_answer = ""
    try:
        with _requests.post("http://localhost:11434/api/generate", json={"model": "phi3:mini", "prompt": prompt, "stream": True, "options": {"temperature": 0.2}}, stream=True, timeout=120) as resp:
            for line in resp.iter_lines():
                if line:
                    chunk = json.loads(line)
                    token = chunk.get("response", "")
                    full_answer += token
                    if token:
                        yield _sse("token", {"token": token})
                    if chunk.get("done"):
                        break
    except Exception as e:
        full_answer = NO_ANSWER_TEXT
        yield _sse("token", {"token": full_answer})

    latency_ms = int((_time.time() - start) * 1000)
    estimated_tokens = estimate_tokens_from_text(prompt + "\n" + full_answer)
    estimated_cost = estimate_llm_cost(estimated_tokens)

    qr = save_query_record(project_id=project_id, question=question, answer=full_answer, sources=sources, latency_ms=latency_ms, model_name="phi3:mini", confidence=confidence, status="answered", top_similarity_score=top_similarity_score, estimated_tokens=estimated_tokens, estimated_cost=estimated_cost)

    payload = {"answer": full_answer, "sources": sources, "confidence": confidence, "status": "answered", "top_similarity_score": top_similarity_score, "latency_ms": latency_ms, "cache_hit": False, "query_id": qr["id"], "estimated_tokens": estimated_tokens, "estimated_cost": estimated_cost}
    set_cached_answer(project_id=project_id, question=question, top_k=top_k, data=payload)
    yield _sse("done", payload)


@router.post("/widget/chat/stream")
def widget_chat_stream(
    body: WidgetChatRequest,
    x_widget_key: str = Header(..., alias="X-Widget-Key"),
):
    """Streaming version of widget chat using SSE."""
    config = get_widget_config_by_key(x_widget_key)

    return StreamingResponse(
        _stream_widget_chat(
            project_id=config.project_id,
            question=body.question,
            top_k=body.top_k,
            retrieval_mode=body.retrieval_mode,
            rerank=body.rerank,
            rewrite_enabled=body.rewrite_query,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── Widget config (public read) ─────────────────────────────────────────────

@router.get("/widget/config")
def get_widget_config_public(
    x_widget_key: str = Header(..., alias="X-Widget-Key"),
):
    """Return public widget configuration (title, colours, welcome message)."""
    config = get_widget_config_by_key(x_widget_key)
    return {
        "title": config.title,
        "welcome_message": config.welcome_message,
        "primary_color": config.primary_color,
        "position": config.position,
        "logo_url": config.logo_url,
    }


# ─── Widget config management (JWT-protected) ────────────────────────────────

@router.get("/projects/{project_id}/widget-config", response_model=WidgetConfigResponse)
def get_project_widget_config(
    project_id: str,
    current_user: User = Depends(get_current_user),
):
    """Fetch widget config for a project (dashboard use). Creates one if missing."""
    check_project_access(current_user, project_id)

    with SessionLocal() as db:
        config = db.execute(
            select(WidgetConfig).where(WidgetConfig.project_id == project_id)
        ).scalar_one_or_none()

        if not config:
            config = WidgetConfig(
                id=str(uuid4()),
                project_id=project_id,
                title="Company Assistant",
                welcome_message="Hello! How can I help you today?",
                primary_color="#6D28D9",
                position="bottom-right",
                is_enabled=True,
                widget_public_key=f"widget_pk_{uuid4().hex}"
            )
            db.add(config)
            db.commit()
            db.refresh(config)

        db.expunge(config)

    return {
        "project_id": config.project_id,
        "title": config.title,
        "welcome_message": config.welcome_message,
        "primary_color": config.primary_color,
        "position": config.position,
        "is_enabled": config.is_enabled,
        "widget_public_key": config.widget_public_key,
    }


@router.put("/projects/{project_id}/widget-config")
def update_project_widget_config(
    project_id: str,
    body: WidgetConfigUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update widget configuration for a project. Creates one if missing."""
    check_project_access(current_user, project_id)

    with SessionLocal() as db:
        config = db.execute(
            select(WidgetConfig).where(WidgetConfig.project_id == project_id)
        ).scalar_one_or_none()

        if not config:
            config = WidgetConfig(
                id=str(uuid4()),
                project_id=project_id,
                title="Company Assistant",
                welcome_message="Hello! How can I help you today?",
                primary_color="#6D28D9",
                position="bottom-right",
                is_enabled=True,
                widget_public_key=f"widget_pk_{uuid4().hex}"
            )
            db.add(config)

        if body.title is not None:
            config.title = body.title
        if body.welcome_message is not None:
            config.welcome_message = body.welcome_message
        if body.primary_color is not None:
            config.primary_color = body.primary_color
        if body.position is not None:
            config.position = body.position
        if body.allowed_domains is not None:
            config.allowed_domains = body.allowed_domains
        if body.logo_url is not None:
            config.logo_url = body.logo_url
        if body.is_enabled is not None:
            config.is_enabled = body.is_enabled

        db.commit()
        db.refresh(config)

        return {
            "message": "Widget configuration updated",
            "project_id": project_id,
            "title": config.title,
            "welcome_message": config.welcome_message,
            "primary_color": config.primary_color,
            "position": config.position,
            "is_enabled": config.is_enabled,
            "widget_public_key": config.widget_public_key,
        }

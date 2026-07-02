"""
Streaming Chat Route — /api/v1/chat/stream
Yields answer tokens as Server-Sent Events (SSE) so the frontend can
display a live typewriter effect.
"""
import json
import time
import requests
from uuid import uuid4
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.db.schemas import ChatRequest
from app.api.routes_documents import flexible_auth, check_flexible_project_access
from app.services.cache_service import get_cached_answer, set_cached_answer
from app.services.vector_service import retrieve_chunks
from app.generation.prompts import build_rag_prompt
from app.retrieval.query_rewriter import rewrite_query
from app.retrieval.confidence import (
    NO_ANSWER_TEXT,
    get_top_similarity_score,
    get_confidence_level,
    should_return_no_answer_before_llm,
    filter_context_results,
)
from app.services.chat_service import (
    build_context_from_results,
    build_sources,
    save_query_record,
)
from app.services.monitoring_service import estimate_tokens_from_text, estimate_llm_cost
from app.db.sync_database import SessionLocal
from app.db.models import Project
from app.generation.providers import get_provider

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "phi3:mini"

router = APIRouter()


def _sse(event: str, data: dict) -> str:
    """Format a single SSE message."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _stream_ollama(prompt: str):
    """
    Call Ollama with stream=True and yield each token chunk.
    Falls back to a single response if streaming fails.
    """
    url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": True,
        "options": {"temperature": 0.2, "top_p": 0.9},
    }
    try:
        with requests.post(url, json=payload, stream=True, timeout=120) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if line:
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("response", "")
                        done = chunk.get("done", False)
                        yield token, done
                        if done:
                            break
                    except Exception:
                        continue
    except Exception as exc:
        yield f"\n[LLM error: {exc}]", True


async def _stream_response(
    project_id: str,
    question: str,
    top_k: int,
    rewrite_enabled: bool,
    retrieval_mode: str,
    rerank: bool,
):
    start_time = time.time()

    # ── 1. Cache check ──────────────────────────────────────────────────────
    cached = get_cached_answer(project_id=project_id, question=question, top_k=top_k)
    if cached:
        answer = cached.get("answer", "")
        # Stream cached answer token by token (word-by-word)
        words = answer.split(" ")
        for i, word in enumerate(words):
            token = word if i == 0 else " " + word
            yield _sse("token", {"token": token})
            # tiny artificial delay so the UI feels alive
            time.sleep(0.01)

        latency_ms = int((time.time() - start_time) * 1000)
        yield _sse(
            "done",
            {
                "answer": answer,
                "sources": cached.get("sources", []),
                "confidence": cached.get("confidence"),
                "status": cached.get("status"),
                "top_similarity_score": cached.get("top_similarity_score"),
                "latency_ms": latency_ms,
                "cache_hit": True,
                "query_id": cached.get("query_id"),
            },
        )
        return

    # Load project configuration
    with SessionLocal() as db:
        project = db.get(Project, project_id)

    if not project:
        provider_name = "gemini"
        model_name = "gemini-2.5-flash"
    else:
        provider_name = project.default_llm_provider or "gemini"
        model_name = project.default_model_name or "gemini-2.5-flash"

    provider = get_provider(provider_name, model_name)

    # ── 2. Query rewriting ──────────────────────────────────────────────────
    rewrite_result = {
        "original_query": question,
        "rewritten_query": question,
        "was_rewritten": False,
    }
    if rewrite_enabled:
        rewrite_result = rewrite_query(question, provider=provider)

    retrieval_query = rewrite_result["rewritten_query"]

    # ── 3. Retrieval ────────────────────────────────────────────────────────
    search_response = retrieve_chunks(
        project_id=project_id,
        query=retrieval_query,
        top_k=top_k,
        retrieval_mode=retrieval_mode,
        rerank=rerank,
    )
    raw_results = search_response.get("results", [])
    retrieved_results = filter_context_results(results=raw_results, max_results=top_k)

    top_similarity_score = get_top_similarity_score(retrieved_results)
    confidence = get_confidence_level(top_similarity_score)
    sources = build_sources(retrieved_results)

    # ── 4. No-answer shortcircuit ───────────────────────────────────────────
    if not retrieved_results or should_return_no_answer_before_llm(top_similarity_score):
        latency_ms = int((time.time() - start_time) * 1000)
        query_record = save_query_record(
            project_id=project_id,
            question=question,
            answer=NO_ANSWER_TEXT,
            sources=[],
            latency_ms=latency_ms,
            model_name=model_name,
            status="no_answer",
            confidence="low",
            top_similarity_score=top_similarity_score,
        )
        yield _sse("token", {"token": NO_ANSWER_TEXT})
        yield _sse(
            "done",
            {
                "answer": NO_ANSWER_TEXT,
                "sources": [],
                "confidence": "low",
                "status": "no_answer",
                "top_similarity_score": top_similarity_score,
                "latency_ms": latency_ms,
                "cache_hit": False,
                "query_id": query_record["id"],
            },
        )
        return

    # ── 5. Build prompt ─────────────────────────────────────────────────────
    context = build_context_from_results(retrieved_results)
    prompt = build_rag_prompt(question=question, context=context)

    # ── 6. Stream LLM tokens ────────────────────────────────────────────────
    full_answer = ""
    for token in provider.stream(prompt):
        full_answer += token
        if token:
            yield _sse("token", {"token": token})

    # ── 7. Finalise & save ──────────────────────────────────────────────────
    latency_ms = int((time.time() - start_time) * 1000)
    final_status = "answered"
    final_confidence = confidence

    estimated_tokens = estimate_tokens_from_text(prompt + "\n" + full_answer)
    estimated_cost = estimate_llm_cost(estimated_tokens)

    query_record = save_query_record(
        project_id=project_id,
        question=question,
        answer=full_answer,
        sources=sources,
        latency_ms=latency_ms,
        model_name=model_name,
        confidence=final_confidence,
        status=final_status,
        top_similarity_score=top_similarity_score,
        estimated_tokens=estimated_tokens,
        estimated_cost=estimated_cost,
    )

    payload = {
        "answer": full_answer,
        "sources": sources,
        "confidence": final_confidence,
        "status": final_status,
        "top_similarity_score": top_similarity_score,
        "latency_ms": latency_ms,
        "cache_hit": False,
        "query_id": query_record["id"],
        "estimated_tokens": estimated_tokens,
        "estimated_cost": estimated_cost,
    }

    set_cached_answer(
        project_id=project_id,
        question=question,
        top_k=top_k,
        data=payload,
    )

    yield _sse("done", payload)


@router.post("/chat/stream")
async def stream_chat(
    request: ChatRequest,
    auth_ctx: dict = Depends(flexible_auth),
):
    """
    SSE streaming chat endpoint.
    Yields ``event: token`` lines as the LLM generates tokens, then a final
    ``event: done`` line with the full payload (sources, confidence, etc.).
    """
    check_flexible_project_access(auth_ctx, request.project_id)

    return StreamingResponse(
        _stream_response(
            project_id=request.project_id,
            question=request.question,
            top_k=request.top_k,
            rewrite_enabled=request.rewrite_query,
            retrieval_mode=request.retrieval_mode,
            rerank=request.rerank,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

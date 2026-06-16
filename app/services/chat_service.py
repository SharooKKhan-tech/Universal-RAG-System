from uuid import uuid4
from datetime import datetime
import time
from sqlalchemy import select, delete
from app.services.cache_service import (
    get_cached_answer,
    set_cached_answer
)
from app.services.vector_service import retrieve_chunks
from app.generation.prompts import build_rag_prompt
from app.generation.llm_service import generate_answer_with_ollama
from app.retrieval.query_rewriter import rewrite_query
from app.services.monitoring_service import (
    estimate_tokens_from_text,
    estimate_llm_cost
)

from app.retrieval.confidence import (
    NO_ANSWER_TEXT,
    get_top_similarity_score,
    get_confidence_level,
    should_return_no_answer_before_llm,
    is_no_answer_text,
    filter_context_results
)

from app.db.models import QueryLog
from app.db.sync_database import SessionLocal


def query_log_to_dict(query_log: QueryLog):
    return {
        "id": query_log.id,
        "project_id": query_log.project_id,
        "question": query_log.question,
        "answer": query_log.answer,
        "sources": query_log.sources or [],
        "source_count": query_log.source_count,
        "top_similarity_score": query_log.top_similarity_score,
        "confidence": query_log.confidence,
        "status": query_log.status,
        "latency_ms": query_log.latency_ms,
        "model_name": query_log.model_name,
        "estimated_tokens": query_log.estimated_tokens,
        "estimated_cost": query_log.estimated_cost,
        "created_at": query_log.created_at
    }


def load_queries():
    """
    Kept for analytics compatibility.
    Returns all query logs from PostgreSQL as dictionaries.
    """
    with SessionLocal() as db:
        result = db.execute(
            select(QueryLog).order_by(QueryLog.created_at.desc())
        )

        query_logs = result.scalars().all()

        return [
            query_log_to_dict(query_log)
            for query_log in query_logs
        ]


def build_context_from_results(results: list) -> str:
    context_parts = []

    for index, result in enumerate(results, start=1):
        metadata = result.get("metadata", {})

        file_name = metadata.get("file_name", "unknown_file")
        page_number = metadata.get("page_number", 0)

        context_parts.append(
            f"""
Source {index}
File: {file_name}
Page: {page_number}

Content:
{result.get("chunk_text", "")}
""".strip()
        )

    return "\n\n---\n\n".join(context_parts)


def build_sources(results: list) -> list:
    sources = []

    for result in results:
        metadata = result.get("metadata", {})

        sources.append({
            "chunk_id": result.get("chunk_id"),
            "file_name": metadata.get("file_name"),
            "file_type": metadata.get("file_type"),
            "page_number": metadata.get("page_number"),
            "chunk_index": metadata.get("chunk_index"),
            "similarity_score": result.get("similarity_score"),
            "keyword_score": result.get("keyword_score"),
            "semantic_score": result.get("semantic_score"),
            "hybrid_score": result.get("hybrid_score"),
            "confidence_score": result.get("confidence_score"),
            "retrieval_source": result.get("retrieval_source"),
            "was_reranked": result.get("was_reranked", False),
            "rerank_score": result.get("rerank_score"),
            "rerank_score_raw": result.get("rerank_score_raw"),
            "original_rank": result.get("original_rank"),
            "rerank_position": result.get("rerank_position"),
            "distance": result.get("distance")
        })

    return sources


def save_query_record(
    project_id: str,
    question: str,
    answer: str,
    sources: list,
    latency_ms: int,
    model_name: str = "phi3:mini",
    confidence: str | None = None,
    status: str | None = None,
    top_similarity_score: float | None = None,
    estimated_tokens: int = 0,
    estimated_cost: float = 0.0
):
    sources = sources or []

    no_answer_detected = answer.strip().lower() == NO_ANSWER_TEXT.lower()

    similarity_scores = [
        source.get("similarity_score")
        for source in sources
        if isinstance(source, dict) and source.get("similarity_score") is not None
    ]

    calculated_top_score = max(similarity_scores) if similarity_scores else None

    final_top_score = (
        top_similarity_score
        if top_similarity_score is not None
        else calculated_top_score
    )

    final_status = status or ("no_answer" if no_answer_detected else "answered")

    if confidence:
        final_confidence = confidence
    elif no_answer_detected:
        final_confidence = "low"
    elif final_top_score is not None and final_top_score >= 0.65:
        final_confidence = "high"
    elif final_top_score is not None and final_top_score >= 0.45:
        final_confidence = "medium"
    else:
        final_confidence = "low"

    with SessionLocal() as db:
        query_log = QueryLog(
            id=str(uuid4()),
            project_id=project_id,
            question=question,
            answer=answer,
            sources=sources,
            source_count=len(sources),
            top_similarity_score=final_top_score,
            confidence=final_confidence,
            status=final_status,
            latency_ms=latency_ms,
            model_name=model_name,
            estimated_tokens=estimated_tokens,
            estimated_cost=estimated_cost,
            created_at=datetime.utcnow()
        )

        db.add(query_log)
        db.commit()
        db.refresh(query_log)

        return query_log_to_dict(query_log)


def answer_question(
    project_id: str,
    question: str,
    top_k: int = 5,
    rewrite_enabled: bool = True,
    retrieval_mode: str = "hybrid",
    rerank: bool = True
):
    start_time = time.time()

    cached_response = get_cached_answer(
        project_id=project_id,
        question=question,
        top_k=top_k
    )

    if cached_response:
        latency_ms = int((time.time() - start_time) * 1000)

        query_record = save_query_record(
            project_id=project_id,
            question=question,
            answer=cached_response["answer"],
            sources=cached_response.get("sources", []),
            latency_ms=latency_ms,
            model_name="cache",
            confidence=cached_response.get("confidence"),
            status=cached_response.get("status"),
            top_similarity_score=cached_response.get("top_similarity_score"),
            estimated_tokens=0,
            estimated_cost=0.0
        )

        cached_response["latency_ms"] = latency_ms
        cached_response["cache_hit"] = True
        cached_response["estimated_tokens"] = 0
        cached_response["estimated_cost"] = 0.0
        cached_response["query_id"] = query_record["id"]

        return cached_response

    rewrite_result = {
        "original_query": question,
        "rewritten_query": question,
        "was_rewritten": False
    }

    if rewrite_enabled:
        rewrite_result = rewrite_query(question)

    retrieval_query = rewrite_result["rewritten_query"]

    search_response = retrieve_chunks(
        project_id=project_id,
        query=retrieval_query,
        top_k=top_k,
        retrieval_mode=retrieval_mode,
        rerank=rerank
    )

    raw_retrieved_results = search_response.get("results", [])

    retrieved_results = filter_context_results(
        results=raw_retrieved_results,
        max_results=top_k
    )

    top_similarity_score = get_top_similarity_score(retrieved_results)
    confidence = get_confidence_level(top_similarity_score)

    # Case 1: No chunks retrieved
    if not retrieved_results:
        latency_ms = int((time.time() - start_time) * 1000)

        query_record = save_query_record(
            project_id=project_id,
            question=question,
            answer=NO_ANSWER_TEXT,
            sources=[],
            latency_ms=latency_ms,
            model_name="phi3:mini",
            status="no_answer",
            confidence="low",
            top_similarity_score=None
        )

        response_payload = {
            "answer": NO_ANSWER_TEXT,
            "status": "no_answer",
            "confidence": "low",
            "top_similarity_score": None,
            "original_query": question,
            "sources": [],
            "latency_ms": latency_ms,
            "model_name": "phi3:mini",
            "query_id": query_record["id"],
            "cache_hit": False,
            "estimated_tokens": 0,
            "estimated_cost": 0.0
        }

        set_cached_answer(
            project_id=project_id,
            question=question,
            top_k=top_k,
            data=response_payload
        )

        return response_payload

    # Case 2: Retrieved chunks are too weak
    if should_return_no_answer_before_llm(top_similarity_score):
        latency_ms = int((time.time() - start_time) * 1000)

        query_record = save_query_record(
            project_id=project_id,
            question=question,
            answer=NO_ANSWER_TEXT,
            sources=[],
            latency_ms=latency_ms,
            model_name="phi3:mini",
            status="no_answer",
            confidence=confidence,
            top_similarity_score=top_similarity_score
        )

        response_payload = {
            "answer": NO_ANSWER_TEXT,
            "status": "no_answer",
            "confidence": confidence,
            "top_similarity_score": top_similarity_score,
            "original_query": question,
            "sources": [],
            "latency_ms": latency_ms,
            "model_name": "phi3:mini",
            "query_id": query_record["id"],
            "cache_hit": False,
            "estimated_tokens": 0,
            "estimated_cost": 0.0
        }

        set_cached_answer(
            project_id=project_id,
            question=question,
            top_k=top_k,
            data=response_payload
        )

        return response_payload

    # Case 3: Good context found
    context = build_context_from_results(retrieved_results)

    prompt = build_rag_prompt(
        question=question,
        context=context
    )

    answer = generate_answer_with_ollama(prompt)

    sources = build_sources(retrieved_results)

    status = "no_answer" if is_no_answer_text(answer) else "answered"

    if status == "no_answer":
        confidence = "low"

    latency_ms = int((time.time() - start_time) * 1000)

    estimated_tokens = estimate_tokens_from_text(prompt + "\n" + answer)
    estimated_cost = estimate_llm_cost(estimated_tokens)

    query_record = save_query_record(
        project_id=project_id,
        question=question,
        answer=answer,
        sources=sources if status == "answered" else [],
        latency_ms=latency_ms,
        model_name="phi3:mini",
        confidence=confidence,
        status=status,
        top_similarity_score=top_similarity_score,
        estimated_tokens=estimated_tokens,
        estimated_cost=estimated_cost
    )

    response_payload = {
        "answer": answer,
        "sources": sources if status == "answered" else [],
        "latency_ms": latency_ms,
        "model_name": "phi3:mini",
        "query_id": query_record["id"],
        "cache_hit": False,
        "original_query": question
    }

    response_payload["estimated_tokens"] = estimated_tokens
    response_payload["estimated_cost"] = estimated_cost

    if "confidence" in locals():
        response_payload["confidence"] = confidence

    if "status" in locals():
        response_payload["status"] = status

    if "top_similarity_score" in locals():
        response_payload["top_similarity_score"] = top_similarity_score

    set_cached_answer(
        project_id=project_id,
        question=question,
        top_k=top_k,
        data=response_payload
    )

    return response_payload


def get_queries_by_project(project_id: str):
    with SessionLocal() as db:
        result = db.execute(
            select(QueryLog)
            .where(QueryLog.project_id == project_id)
            .order_by(QueryLog.created_at.desc())
        )

        query_logs = result.scalars().all()

        return [
            query_log_to_dict(query_log)
            for query_log in query_logs
        ]

def delete_queries_by_project(project_id: str):
    with SessionLocal() as db:
        existing_logs = db.execute(
            select(QueryLog).where(QueryLog.project_id == project_id)
        ).scalars().all()

        deleted_count = len(existing_logs)

        db.execute(
            delete(QueryLog).where(QueryLog.project_id == project_id)
        )

        db.commit()

        return {
            "message": "Project query history deleted successfully",
            "project_id": project_id,
            "deleted_count": deleted_count
        }
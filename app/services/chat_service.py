import json
from pathlib import Path
from uuid import uuid4
from datetime import datetime
import time

from app.services.vector_service import retrieve_chunks
from app.generation.prompts import build_rag_prompt
from app.generation.llm_service import generate_answer_with_ollama
from app.retrieval.query_rewriter import rewrite_query

from app.retrieval.confidence import (
    NO_ANSWER_TEXT,
    get_top_similarity_score,
    get_confidence_level,
    should_return_no_answer_before_llm,
    is_no_answer_text,
    filter_context_results
)

DATA_DIR = Path("data")
QUERIES_FILE = DATA_DIR / "queries.json"


def ensure_query_storage_exists():
    DATA_DIR.mkdir(exist_ok=True)

    if not QUERIES_FILE.exists():
        QUERIES_FILE.write_text("[]", encoding="utf-8")


def load_queries():
    ensure_query_storage_exists()

    with open(QUERIES_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def save_queries(queries):
    ensure_query_storage_exists()

    with open(QUERIES_FILE, "w", encoding="utf-8") as file:
        json.dump(queries, file, indent=4)


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
    status: str = "answered",
    confidence: str = "medium",
    top_similarity_score: float | None = None,
    no_answer_reason: str | None = None,
    rewritten_query: str | None = None,
    was_query_rewritten: bool = False,
    retrieval_mode: str = "hybrid",
    rerank: bool = True
):
    queries = load_queries()

    if is_no_answer_text(answer):
        status = "no_answer"

    record = {
        "id": str(uuid4()),
        "project_id": project_id,
        "question": question,
        "rewritten_query": rewritten_query or question,
        "was_query_rewritten": was_query_rewritten,
        "answer": answer,
        "sources": sources,
        "source_count": len(sources),
        "top_similarity_score": top_similarity_score,
        "confidence": confidence,
        "is_no_answer": status == "no_answer",
        "status": status,
        "no_answer_reason": no_answer_reason,
        "latency_ms": latency_ms,
        "model_name": model_name,
        "created_at": datetime.utcnow().isoformat(),
        "retrieval_mode": retrieval_mode,
        "rerank": rerank
    }

    queries.append(record)
    save_queries(queries)

    return record


def answer_question(
    project_id: str,
    question: str,
    top_k: int = 5,
    rewrite_enabled: bool = True,
    retrieval_mode: str = "hybrid",
    rerank: bool = True
):
    start_time = time.time()

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
            status="no_answer",
            confidence="low",
            top_similarity_score=None,
            no_answer_reason="No relevant chunks retrieved",
            rewritten_query=retrieval_query,
            was_query_rewritten=rewrite_result["was_rewritten"],
            retrieval_mode=retrieval_mode,
            rerank=rerank
        )

        return {
            "answer": NO_ANSWER_TEXT,
            "status": "no_answer",
            "confidence": "low",
            "top_similarity_score": None,
            "no_answer_reason": "No relevant chunks retrieved",
            "original_query": question,
            "rewritten_query": retrieval_query,
            "was_query_rewritten": rewrite_result["was_rewritten"],
            "retrieval_mode": retrieval_mode,
            "rerank": rerank,
            "sources": [],
            "latency_ms": latency_ms,
            "model_name": "phi3:mini",
            "query_id": query_record["id"]
        }

    # Case 2: Retrieved chunks are too weak
    if should_return_no_answer_before_llm(top_similarity_score):
        latency_ms = int((time.time() - start_time) * 1000)

        query_record = save_query_record(
            project_id=project_id,
            question=question,
            answer=NO_ANSWER_TEXT,
            sources=[],
            latency_ms=latency_ms,
            status="no_answer",
            confidence=confidence,
            top_similarity_score=top_similarity_score,
            no_answer_reason="Top similarity score is below threshold",
            rewritten_query=retrieval_query,
            was_query_rewritten=rewrite_result["was_rewritten"],
            retrieval_mode=retrieval_mode,
            rerank=rerank
        )

        return {
            "answer": NO_ANSWER_TEXT,
            "status": "no_answer",
            "confidence": confidence,
            "top_similarity_score": top_similarity_score,
            "no_answer_reason": "Top similarity score is below threshold",
            "original_query": question,
            "rewritten_query": retrieval_query,
            "was_query_rewritten": rewrite_result["was_rewritten"],
            "retrieval_mode": retrieval_mode,
            "rerank": rerank,
            "sources": [],
            "latency_ms": latency_ms,
            "model_name": "phi3:mini",
            "query_id": query_record["id"]
        }

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

    query_record = save_query_record(
        project_id=project_id,
        question=question,
        answer=answer,
        sources=sources if status == "answered" else [],
        latency_ms=latency_ms,
        status=status,
        confidence=confidence,
        top_similarity_score=top_similarity_score,
        no_answer_reason=None if status == "answered" else "LLM could not answer from context",
        rewritten_query=retrieval_query,
        was_query_rewritten=rewrite_result["was_rewritten"],
        retrieval_mode=retrieval_mode,
        rerank=rerank
    )

    return {
        "answer": answer,
        "status": status,
        "confidence": confidence,
        "top_similarity_score": top_similarity_score,
        "original_query": question,
        "rewritten_query": retrieval_query,
        "was_query_rewritten": rewrite_result["was_rewritten"],
        "retrieval_mode": retrieval_mode,
        "rerank": rerank,
        "sources": sources if status == "answered" else [],
        "latency_ms": latency_ms,
        "model_name": "phi3:mini",
        "query_id": query_record["id"]
    }


def get_queries_by_project(project_id: str):
    queries = load_queries()

    return [
        query for query in queries
        if query["project_id"] == project_id
    ]

def delete_queries_by_project(project_id: str):
    queries = load_queries()

    remaining_queries = [
        query for query in queries
        if query["project_id"] != project_id
    ]

    deleted_count = len(queries) - len(remaining_queries)

    save_queries(remaining_queries)

    return {
        "message": "Project query history deleted successfully",
        "project_id": project_id,
        "deleted_count": deleted_count
    }
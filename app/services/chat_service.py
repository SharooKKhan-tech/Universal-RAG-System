import json
from pathlib import Path
from uuid import uuid4
from datetime import datetime
import time

from app.services.vector_service import semantic_search
from app.generation.prompts import build_rag_prompt
from app.generation.llm_service import generate_answer_with_ollama

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
            "distance": result.get("distance")
        })

    return sources


def save_query_record(
    project_id: str,
    question: str,
    answer: str,
    sources: list,
    latency_ms: int,
    model_name: str = "phi3:mini"
):
    queries = load_queries()

    no_answer_text = "I don't have enough information in the uploaded documents to answer this."

    is_no_answer = answer.strip().lower() == no_answer_text.lower()

    similarity_scores = [
        source.get("similarity_score")
        for source in sources
        if source.get("similarity_score") is not None
    ]

    top_similarity_score = max(similarity_scores) if similarity_scores else None

    record = {
        "id": str(uuid4()),
        "project_id": project_id,
        "question": question,
        "answer": answer,
        "sources": sources,
        "source_count": len(sources),
        "top_similarity_score": top_similarity_score,
        "is_no_answer": is_no_answer,
        "status": "no_answer" if is_no_answer else "answered",
        "latency_ms": latency_ms,
        "model_name": model_name,
        "created_at": datetime.utcnow().isoformat()
    }

    queries.append(record)
    save_queries(queries)

    return record


def answer_question(project_id: str, question: str, top_k: int = 5):
    start_time = time.time()

    search_response = semantic_search(
        project_id=project_id,
        query=question,
        top_k=top_k
    )

    retrieved_results = search_response.get("results", [])

    if not retrieved_results:
        answer = "I don't have enough information in the uploaded documents to answer this."
        sources = []

        latency_ms = int((time.time() - start_time) * 1000)

        query_record = save_query_record(
            project_id=project_id,
            question=question,
            answer=answer,
            sources=sources,
            latency_ms=latency_ms
        )

        return {
            "answer": answer,
            "sources": sources,
            "latency_ms": latency_ms,
            "query_id": query_record["id"]
        }

    context = build_context_from_results(retrieved_results)

    prompt = build_rag_prompt(
        question=question,
        context=context
    )

    answer = generate_answer_with_ollama(prompt)

    sources = build_sources(retrieved_results)

    latency_ms = int((time.time() - start_time) * 1000)

    query_record = save_query_record(
        project_id=project_id,
        question=question,
        answer=answer,
        sources=sources,
        latency_ms=latency_ms
    )

    return {
        "answer": answer,
        "sources": sources,
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
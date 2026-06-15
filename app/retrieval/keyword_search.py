import re
from collections import Counter

from app.services.chunk_service import get_chunks_by_project
from app.services.document_service import get_document_by_id


STOPWORDS = {
    "the", "is", "are", "a", "an", "and", "or", "to", "of", "in", "on",
    "for", "with", "about", "what", "how", "when", "where", "why", "who",
    "can", "i", "me", "my", "this", "that", "it", "does", "do", "tell",
    "explain", "give", "details"
}


def tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())

    return [
        token for token in tokens
        if token not in STOPWORDS and len(token) >= 2
    ]


def calculate_keyword_score(query: str, text: str) -> float:
    query_tokens = tokenize(query)
    text_tokens = tokenize(text)

    if not query_tokens or not text_tokens:
        return 0.0

    query_unique = set(query_tokens)
    text_counter = Counter(text_tokens)

    matched_terms = [
        token for token in query_unique
        if token in text_counter
    ]

    if not matched_terms:
        return 0.0

    coverage_score = len(matched_terms) / len(query_unique)

    frequency_score = sum(
        min(text_counter[token], 3)
        for token in matched_terms
    ) / (len(query_unique) * 3)

    phrase_bonus = 0.0

    if query.lower().strip() in text.lower():
        phrase_bonus = 0.2

    final_score = (0.7 * coverage_score) + (0.3 * frequency_score) + phrase_bonus

    return round(min(final_score, 1.0), 4)


def build_keyword_result(chunk: dict, keyword_score: float) -> dict:
    document = get_document_by_id(chunk["document_id"])

    metadata = {
        "project_id": chunk["project_id"],
        "document_id": chunk["document_id"],
        "chunk_index": chunk["chunk_index"],
        "page_number": chunk["page_number"] if chunk["page_number"] else 0,
        "file_name": document["file_name"] if document else "unknown",
        "file_type": document["file_type"] if document else "unknown"
    }

    return {
        "chunk_id": chunk["id"],
        "chunk_text": chunk["chunk_text"],
        "metadata": metadata,
        "keyword_score": keyword_score,
        "similarity_score": keyword_score,
        "confidence_score": keyword_score,
        "distance": None,
        "retrieval_source": "keyword"
    }


def keyword_search_chunks(
    project_id: str,
    query: str,
    top_k: int = 5
) -> list[dict]:
    chunks = get_chunks_by_project(project_id)

    results = []

    for chunk in chunks:
        score = calculate_keyword_score(
            query=query,
            text=chunk["chunk_text"]
        )

        if score <= 0:
            continue

        results.append(
            build_keyword_result(
                chunk=chunk,
                keyword_score=score
            )
        )

    results = sorted(
        results,
        key=lambda item: item["keyword_score"],
        reverse=True
    )

    return results[:top_k]
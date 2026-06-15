def reciprocal_rank_score(rank: int, k: int = 60) -> float:
    return 1 / (k + rank)


def merge_hybrid_results(
    semantic_results: list,
    keyword_results: list,
    top_k: int = 5,
    semantic_weight: float = 0.65,
    keyword_weight: float = 0.35
) -> list:
    merged = {}

    for rank, result in enumerate(semantic_results, start=1):
        chunk_id = result["chunk_id"]

        if chunk_id not in merged:
            merged[chunk_id] = result.copy()
            merged[chunk_id]["semantic_score"] = result.get("similarity_score", 0)
            merged[chunk_id]["keyword_score"] = 0
            merged[chunk_id]["hybrid_score"] = 0
            merged[chunk_id]["retrieval_source"] = "semantic"

        merged[chunk_id]["hybrid_score"] += (
            semantic_weight * reciprocal_rank_score(rank)
        )

    for rank, result in enumerate(keyword_results, start=1):
        chunk_id = result["chunk_id"]

        if chunk_id not in merged:
            merged[chunk_id] = result.copy()
            merged[chunk_id]["semantic_score"] = 0
            merged[chunk_id]["keyword_score"] = result.get("keyword_score", 0)
            merged[chunk_id]["hybrid_score"] = 0
            merged[chunk_id]["retrieval_source"] = "keyword"
        else:
            merged[chunk_id]["keyword_score"] = result.get("keyword_score", 0)
            merged[chunk_id]["retrieval_source"] = "semantic+keyword"

        merged[chunk_id]["hybrid_score"] += (
            keyword_weight * reciprocal_rank_score(rank)
        )

    final_results = []

    for result in merged.values():
        semantic_score = result.get("semantic_score", 0) or 0
        keyword_score = result.get("keyword_score", 0) or 0

        confidence_score = max(semantic_score, keyword_score)

        result["hybrid_score"] = round(result.get("hybrid_score", 0) * 100, 4)
        result["confidence_score"] = round(confidence_score, 4)
        result["similarity_score"] = round(confidence_score, 4)

        final_results.append(result)

    final_results = sorted(
        final_results,
        key=lambda item: (
            item.get("hybrid_score", 0),
            item.get("confidence_score", 0)
        ),
        reverse=True
    )

    return final_results[:top_k]
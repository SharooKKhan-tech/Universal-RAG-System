import math
from typing import List, Dict, Any

from sentence_transformers import CrossEncoder


RERANKER_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"

_reranker_model = None


def get_reranker_model():
    global _reranker_model

    if _reranker_model is None:
        _reranker_model = CrossEncoder(RERANKER_MODEL_NAME)

    return _reranker_model


def sigmoid(value: float) -> float:
    try:
        return 1 / (1 + math.exp(-value))
    except OverflowError:
        return 0.0 if value < 0 else 1.0


def rerank_results(
    query: str,
    results: List[Dict[str, Any]],
    top_k: int = 5
) -> List[Dict[str, Any]]:
    """
    Reranks retrieved chunks using a cross-encoder model.
    This does not replace semantic/keyword scores.
    It only adds rerank_score and sorts results by rerank relevance.
    """

    if not results:
        return []

    try:
        model = get_reranker_model()

        pairs = [
            [query, result.get("chunk_text", "")]
            for result in results
        ]

        raw_scores = model.predict(pairs)

        reranked_results = []

        for original_rank, (result, raw_score) in enumerate(
            zip(results, raw_scores),
            start=1
        ):
            raw_score_float = float(raw_score)
            normalized_score = sigmoid(raw_score_float)

            updated_result = result.copy()
            updated_result["original_rank"] = original_rank
            updated_result["rerank_score_raw"] = round(raw_score_float, 4)
            updated_result["rerank_score"] = round(normalized_score, 4)
            updated_result["was_reranked"] = True

            reranked_results.append(updated_result)

        reranked_results = sorted(
            reranked_results,
            key=lambda item: item.get("rerank_score", 0),
            reverse=True
        )

        for rerank_position, result in enumerate(reranked_results, start=1):
            result["rerank_position"] = rerank_position

        return reranked_results[:top_k]

    except Exception as error:
        # Safe fallback: if reranker fails, return original results.
        fallback_results = []

        for index, result in enumerate(results[:top_k], start=1):
            updated_result = result.copy()
            updated_result["was_reranked"] = False
            updated_result["rerank_error"] = str(error)
            updated_result["original_rank"] = index
            fallback_results.append(updated_result)

        return fallback_results
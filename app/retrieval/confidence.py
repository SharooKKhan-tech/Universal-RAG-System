NO_ANSWER_TEXT = "I don't have enough information in the uploaded documents to answer this."

# You can tune these values after testing.
MIN_SIMILARITY_SCORE = 0.20
MEDIUM_CONFIDENCE_SCORE = 0.45
HIGH_CONFIDENCE_SCORE = 0.65


def get_top_similarity_score(results: list) -> float | None:
    scores = [
        result.get("similarity_score")
        for result in results
        if result.get("similarity_score") is not None
    ]

    if not scores:
        return None

    return max(scores)


def get_confidence_level(top_similarity_score: float | None) -> str:
    if top_similarity_score is None:
        return "low"

    if top_similarity_score >= HIGH_CONFIDENCE_SCORE:
        return "high"

    if top_similarity_score >= MEDIUM_CONFIDENCE_SCORE:
        return "medium"

    return "low"


def should_return_no_answer_before_llm(top_similarity_score: float | None) -> bool:
    if top_similarity_score is None:
        return True

    return top_similarity_score < MIN_SIMILARITY_SCORE


def is_no_answer_text(answer: str) -> bool:
    return answer.strip().lower() == NO_ANSWER_TEXT.lower()
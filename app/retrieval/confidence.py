NO_ANSWER_TEXT = "I don't have enough information in the uploaded documents to answer this."

# Tuned for Chroma cosine + SentenceTransformer local embeddings
MIN_SIMILARITY_SCORE = 0.18
MEDIUM_CONFIDENCE_SCORE = 0.35
HIGH_CONFIDENCE_SCORE = 0.55

# Used to remove weak context chunks before sending to LLM
MIN_CONTEXT_SCORE = 0.30


def get_top_similarity_score(results: list) -> float | None:
    scores = []

    for result in results:
        score = (
            result.get("confidence_score")
            or result.get("similarity_score")
            or result.get("keyword_score")
        )

        if score is not None:
            scores.append(score)

    if not scores:
        return None

    return max(scores)


def get_result_score(result: dict) -> float:
    score = (
        result.get("confidence_score")
        or result.get("similarity_score")
        or result.get("keyword_score")
        or 0
    )

    return float(score)


def filter_context_results(
    results: list,
    max_results: int = 5,
    min_context_score: float = MIN_CONTEXT_SCORE
) -> list:
    """
    Keeps only useful chunks before sending context to LLM.
    Always keeps the top result if it passes the minimum no-answer threshold.
    """

    if not results:
        return []

    filtered_results = []

    for index, result in enumerate(results):
        score = get_result_score(result)

        # Always allow the first result if it is above no-answer threshold
        if index == 0 and score >= MIN_SIMILARITY_SCORE:
            filtered_results.append(result)
            continue

        # Other chunks must pass stronger context threshold
        if score >= min_context_score:
            filtered_results.append(result)

    return filtered_results[:max_results]


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
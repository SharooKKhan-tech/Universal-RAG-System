import re
from fastapi import HTTPException

from app.generation.prompts import build_query_rewrite_prompt
from app.generation.llm_service import generate_text_with_ollama


def clean_rewritten_query(text: str) -> str:
    text = text.strip()

    prefixes = [
        "rewritten query:",
        "query:",
        "search query:",
        "answer:"
    ]

    lowered = text.lower()

    for prefix in prefixes:
        if lowered.startswith(prefix):
            text = text[len(prefix):].strip()
            break

    text = text.replace('"', "").replace("'", "").strip()

    # Keep only first line if model returns extra text
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if lines:
        text = lines[0]

    return text.strip()


def is_rewrite_useful(original_question: str, rewritten_query: str) -> bool:
    if not rewritten_query:
        return False

    if len(rewritten_query) < 5:
        return False

    if rewritten_query.lower() == original_question.lower():
        return False

    # Avoid extremely long rewrite
    if len(rewritten_query) > 500:
        return False

    return True


def should_rewrite_query(question: str) -> bool:
    words = re.findall(r"\w+", question.lower())

    # Very short questions should be rewritten
    if len(words) <= 3:
        return True

    # Clear questions should not be rewritten
    clear_question_patterns = [
        "what is the",
        "what are the",
        "how many",
        "what proof",
        "what documents",
        "what rule",
        "what policy"
    ]

    question_lower = question.lower().strip()

    for pattern in clear_question_patterns:
        if question_lower.startswith(pattern):
            return False

    # Rewrite short vague questions only
    vague_terms = {
        "refund", "leave", "salary", "password", "travel",
        "policy", "rules", "process", "details"
    }

    if len(words) <= 6 and any(word in vague_terms for word in words):
        return True

    return False


def rewrite_query(question: str, force: bool = False) -> dict:
    """
    Returns:
    {
        "original_query": "...",
        "rewritten_query": "...",
        "was_rewritten": true/false
    }
    """

    if not force and not should_rewrite_query(question):
        return {
            "original_query": question,
            "rewritten_query": question,
            "was_rewritten": False
        }

    try:
        prompt = build_query_rewrite_prompt(question)

        raw_rewrite = generate_text_with_ollama(
            prompt=prompt,
            temperature=0.0,
            timeout=60
        )

        cleaned_rewrite = clean_rewritten_query(raw_rewrite)

        if not is_rewrite_useful(question, cleaned_rewrite):
            return {
                "original_query": question,
                "rewritten_query": question,
                "was_rewritten": False
            }

        return {
            "original_query": question,
            "rewritten_query": cleaned_rewrite,
            "was_rewritten": True
        }

    except HTTPException:
        raise

    except Exception:
        # Safe fallback: never break chat because rewriting failed
        return {
            "original_query": question,
            "rewritten_query": question,
            "was_rewritten": False
        }
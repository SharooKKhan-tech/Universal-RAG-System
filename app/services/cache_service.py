import json
import hashlib
from typing import Any
import redis
from fastapi import HTTPException

from app.core.config import settings


redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    decode_responses=True
)


def check_redis_connection():
    try:
        return redis_client.ping()
    except Exception:
        return False


def normalize_question(question: str) -> str:
    return " ".join(question.lower().strip().split())


def build_chat_cache_key(project_id: str, question: str, top_k: int) -> str:
    normalized_question = normalize_question(question)

    raw_key = f"{project_id}:{normalized_question}:top_k:{top_k}"
    hashed_key = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    return f"rag:chat:{project_id}:{hashed_key}"


def get_cached_answer(project_id: str, question: str, top_k: int):
    cache_key = build_chat_cache_key(project_id, question, top_k)

    cached_data = redis_client.get(cache_key)

    if not cached_data:
        increment_cache_miss(project_id)
        return None

    increment_cache_hit(project_id)

    return json.loads(cached_data)


def set_cached_answer(
    project_id: str,
    question: str,
    top_k: int,
    data: dict,
    ttl_seconds: int | None = None
):
    cache_key = build_chat_cache_key(project_id, question, top_k)

    redis_client.setex(
        cache_key,
        ttl_seconds or settings.REDIS_CACHE_TTL_SECONDS,
        json.dumps(data, default=str)
    )

    return cache_key


def delete_project_chat_cache(project_id: str):
    pattern = f"rag:chat:{project_id}:*"

    deleted_count = 0

    for key in redis_client.scan_iter(match=pattern):
        redis_client.delete(key)
        deleted_count += 1

    return {
        "project_id": project_id,
        "deleted_cache_keys": deleted_count
    }


def increment_cache_hit(project_id: str):
    redis_client.incr(f"rag:cache_stats:{project_id}:hits")


def increment_cache_miss(project_id: str):
    redis_client.incr(f"rag:cache_stats:{project_id}:misses")


def get_cache_stats(project_id: str):
    hits = int(redis_client.get(f"rag:cache_stats:{project_id}:hits") or 0)
    misses = int(redis_client.get(f"rag:cache_stats:{project_id}:misses") or 0)

    total = hits + misses
    hit_rate = round((hits / total) * 100, 2) if total else 0

    return {
        "project_id": project_id,
        "cache_hits": hits,
        "cache_misses": misses,
        "total_cache_checks": total,
        "cache_hit_rate_percentage": hit_rate
    }


def reset_cache_stats(project_id: str):
    redis_client.delete(f"rag:cache_stats:{project_id}:hits")
    redis_client.delete(f"rag:cache_stats:{project_id}:misses")

    return {
        "message": "Cache stats reset successfully",
        "project_id": project_id
    }
import json
import hashlib
from typing import Any
from uuid import uuid4
import redis
from fastapi import HTTPException
from qdrant_client.http import models

from app.core.config import settings
from app.embeddings.local_embeddings import embedding_provider
from app.vectorstores.qdrant_store import vector_store

SEMANTIC_CACHE_THRESHOLD = 0.82


redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    decode_responses=True,
    socket_timeout=0.2,
    socket_connect_timeout=0.2,
    retry_on_timeout=False
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
    try:
        # 1. Generate embedding for query
        query_embedding = embedding_provider.embed_query(question)
        if not query_embedding:
            return None

        # 2. Search for semantically similar cached queries in Qdrant
        search_results = vector_store.client.query_points(
            collection_name=vector_store.cache_collection_name,
            query=query_embedding,
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="project_id",
                        match=models.MatchValue(value=project_id)
                    ),
                    models.FieldCondition(
                        key="top_k",
                        match=models.MatchValue(value=top_k)
                    )
                ]
            ),
            limit=1
        )

        points = search_results.points
        if not points:
            increment_cache_miss(project_id)
            return None

        hit = points[0]
        # Check if similarity meets semantic cache threshold
        if hit.score >= SEMANTIC_CACHE_THRESHOLD:
            redis_cache_key = hit.payload.get("redis_cache_key")
            cached_data = redis_client.get(redis_cache_key)

            if cached_data:
                increment_cache_hit(project_id)
                print(f"[Semantic Cache HIT] Match: '{hit.payload.get('question')}' with score: {hit.score:.4f}")
                return json.loads(cached_data)
            else:
                # Key expired in Redis; clean up corresponding vector in Qdrant
                try:
                    vector_store.client.delete(
                        collection_name=vector_store.cache_collection_name,
                        points_selector=models.PointIdsList(points=[hit.id])
                    )
                except Exception:
                    pass

        increment_cache_miss(project_id)
        return None
    except Exception as e:
        print(f"[Semantic Cache Error] Fetch error: {e}")
        return None


def set_cached_answer(
    project_id: str,
    question: str,
    top_k: int,
    data: dict,
    ttl_seconds: int | None = None
):
    try:
        cache_id = str(uuid4())
        redis_cache_key = f"rag:chat:{project_id}:semantic:{cache_id}"

        # 1. Store answer payload in Redis with TTL
        redis_client.setex(
            redis_cache_key,
            ttl_seconds or settings.REDIS_CACHE_TTL_SECONDS,
            json.dumps(data, default=str)
        )

        # 2. Compute embedding vector
        query_embedding = embedding_provider.embed_query(question)
        if query_embedding:
            # 3. Index vector and payload in Qdrant cache collection
            vector_store.client.upsert(
                collection_name=vector_store.cache_collection_name,
                points=[
                    models.PointStruct(
                        id=cache_id,
                        vector=query_embedding,
                        payload={
                            "project_id": project_id,
                            "redis_cache_key": redis_cache_key,
                            "question": question,
                            "top_k": top_k
                        }
                    )
                ]
            )
        return redis_cache_key
    except Exception as e:
        print(f"[Semantic Cache Error] Set error: {e}")
        return None


def delete_project_chat_cache(project_id: str):
    try:
        # 1. Delete matching vectors in Qdrant cache collection
        try:
            vector_store.client.delete(
                collection_name=vector_store.cache_collection_name,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="project_id",
                                match=models.MatchValue(value=project_id)
                            )
                        ]
                    )
                )
            )
        except Exception as q_err:
            print(f"[Semantic Cache Qdrant Delete Warning] {q_err}")

        # 2. Scan and delete matching cache keys in Redis
        pattern = f"rag:chat:{project_id}:*"
        deleted_count = 0

        for key in redis_client.scan_iter(match=pattern):
            redis_client.delete(key)
            deleted_count += 1

        return {
            "project_id": project_id,
            "deleted_cache_keys": deleted_count
        }
    except redis.RedisError:
        return {
            "project_id": project_id,
            "deleted_cache_keys": 0,
            "error": "Redis not available"
        }


def increment_cache_hit(project_id: str):
    try:
        redis_client.incr(f"rag:cache_stats:{project_id}:hits")
    except redis.RedisError:
        pass


def increment_cache_miss(project_id: str):
    try:
        redis_client.incr(f"rag:cache_stats:{project_id}:misses")
    except redis.RedisError:
        pass


def get_cache_stats(project_id: str):
    try:
        hits = int(redis_client.get(f"rag:cache_stats:{project_id}:hits") or 0)
        misses = int(redis_client.get(f"rag:cache_stats:{project_id}:misses") or 0)

        total = hits + misses
        hit_rate = round((hits / total) * 100, 2) if total else 0.0

        # Count live cache keys for this project
        pattern = f"rag:chat:{project_id}:*"
        total_keys = sum(1 for _ in redis_client.scan_iter(match=pattern))

        return {
            "project_id": project_id,
            "redis_connected": True,
            "total_keys": total_keys,
            "hits": hits,
            "misses": misses,
            "hit_rate": hit_rate,
            "memory_usage_mb": 0,       # Redis INFO memory is server-wide, not per-project
            "top_queries": [],           # Not tracked per-query (would need extra Redis keys)
            "hourly_performance": []     # Not tracked per-hour (would need time-series storage)
        }
    except Exception:
        return {
            "project_id": project_id,
            "redis_connected": False,
            "total_keys": 0,
            "hits": 0,
            "misses": 0,
            "hit_rate": 0.0,
            "memory_usage_mb": 0,
            "top_queries": [],
            "hourly_performance": [],
            "error": "Redis not available"
        }



def reset_cache_stats(project_id: str):
    try:
        redis_client.delete(f"rag:cache_stats:{project_id}:hits")
        redis_client.delete(f"rag:cache_stats:{project_id}:misses")

        return {
            "message": "Cache stats reset successfully",
            "project_id": project_id
        }
    except redis.RedisError:
        return {
            "message": "Cache stats reset failed - Redis not available",
            "project_id": project_id
        }
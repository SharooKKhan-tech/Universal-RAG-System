import time
import redis
from fastapi import HTTPException

from app.core.config import settings
from app.services.cache_service import redis_client


def check_rate_limit(api_key_record: dict):
    api_key_id = api_key_record.get("id")
    project_id = api_key_record.get("project_id")

    current_minute = int(time.time() // 60)

    rate_key = f"rag:rate_limit:{project_id}:{api_key_id}:{current_minute}"

    try:
        current_count = redis_client.incr(rate_key)

        if current_count == 1:
            redis_client.expire(rate_key, 70)

        if current_count > settings.RATE_LIMIT_REQUESTS_PER_MINUTE:
            raise HTTPException(
                status_code=429,
                detail={
                    "message": "Rate limit exceeded",
                    "limit_per_minute": settings.RATE_LIMIT_REQUESTS_PER_MINUTE,
                    "project_id": project_id
                }
            )

        return {
            "allowed": True,
            "current_count": current_count,
            "limit": settings.RATE_LIMIT_REQUESTS_PER_MINUTE
        }
    except redis.RedisError:
        # Graceful fallback: bypass rate limiting if Redis is down
        return {
            "allowed": True,
            "current_count": 0,
            "limit": settings.RATE_LIMIT_REQUESTS_PER_MINUTE,
            "redis_error": True
        }
from uuid import uuid4
from datetime import datetime
from statistics import mean
from sqlalchemy import select, func

from app.core.config import settings
from app.db.models import ApiUsageLog, QueryLog, Document, Chunk
from app.db.sync_database import SessionLocal


def estimate_tokens_from_text(text: str) -> int:
    if not text:
        return 0

    return max(1, len(text) // 4)


def estimate_llm_cost(estimated_tokens: int) -> float:
    return round(
        (estimated_tokens / 1000) * settings.ESTIMATED_COST_PER_1K_TOKENS,
        6
    )


def log_api_usage(
    method: str,
    path: str,
    status_code: int,
    latency_ms: int,
    request_id: str,
    project_id: str | None = None,
    api_key_id: str | None = None
):
    with SessionLocal() as db:
        usage_log = ApiUsageLog(
            id=str(uuid4()),
            project_id=project_id,
            api_key_id=api_key_id,
            method=method,
            path=path,
            status_code=status_code,
            latency_ms=latency_ms,
            request_id=request_id,
            created_at=datetime.utcnow()
        )

        db.add(usage_log)
        db.commit()

        return usage_log.id


def get_project_usage_summary(project_id: str):
    with SessionLocal() as db:
        request_logs = db.execute(
            select(ApiUsageLog)
            .where(ApiUsageLog.project_id == project_id)
            .order_by(ApiUsageLog.created_at.desc())
        ).scalars().all()

        query_logs = db.execute(
            select(QueryLog)
            .where(QueryLog.project_id == project_id)
            .order_by(QueryLog.created_at.desc())
        ).scalars().all()

        total_requests = len(request_logs)
        total_queries = len(query_logs)

        total_documents = db.execute(
            select(func.count(Document.id))
            .where(Document.project_id == project_id)
        ).scalar() or 0

        total_chunks = db.execute(
            select(func.count(Chunk.id))
            .where(Chunk.project_id == project_id)
        ).scalar() or 0

        request_latencies = [
            log.latency_ms
            for log in request_logs
            if log.latency_ms is not None
        ]

        query_latencies = [
            log.latency_ms
            for log in query_logs
            if log.latency_ms is not None
        ]

        total_estimated_tokens = sum(
            log.estimated_tokens or 0
            for log in query_logs
        )

        total_estimated_cost = sum(
            log.estimated_cost or 0.0
            for log in query_logs
        )

        status_counts = {}

        for log in request_logs:
            key = str(log.status_code)
            status_counts[key] = status_counts.get(key, 0) + 1

        model_usage = {}

        for log in query_logs:
            model = log.model_name or "unknown"
            model_usage[model] = model_usage.get(model, 0) + 1

        recent_requests = [
            {
                "method": log.method,
                "path": log.path,
                "status_code": log.status_code,
                "latency_ms": log.latency_ms,
                "request_id": log.request_id,
                "created_at": log.created_at
            }
            for log in request_logs[:10]
        ]

        return {
            "project_id": project_id,
            "total_api_requests": total_requests,
            "total_chat_queries": total_queries,
            "total_documents": total_documents,
            "total_chunks": total_chunks,
            "average_api_latency_ms": round(mean(request_latencies), 2) if request_latencies else 0,
            "average_chat_latency_ms": round(mean(query_latencies), 2) if query_latencies else 0,
            "status_code_counts": status_counts,
            "model_usage": model_usage,
            "total_estimated_tokens": total_estimated_tokens,
            "total_estimated_cost": round(total_estimated_cost, 6),
            "recent_requests": recent_requests
        }
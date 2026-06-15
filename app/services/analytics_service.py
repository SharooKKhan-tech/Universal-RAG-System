from collections import Counter, defaultdict
from statistics import mean

from app.services.chat_service import load_queries


NO_ANSWER_TEXT = "I don't have enough information in the uploaded documents to answer this."


def is_no_answer_record(query: dict) -> bool:
    if "is_no_answer" in query:
        return bool(query["is_no_answer"])

    answer = query.get("answer", "").strip().lower()
    return answer == NO_ANSWER_TEXT.lower()


def get_project_queries(project_id: str) -> list:
    queries = load_queries()

    return [
        query for query in queries
        if query.get("project_id") == project_id
    ]


def calculate_project_analytics(project_id: str):
    project_queries = get_project_queries(project_id)

    total_queries = len(project_queries)

    if total_queries == 0:
        return {
            "project_id": project_id,
            "total_queries": 0,
            "answered_queries": 0,
            "no_answer_queries": 0,
            "answer_rate_percentage": 0,
            "average_latency_ms": 0,
            "average_sources_per_answer": 0,
            "model_usage": {},
            "most_used_source_files": [],
            "recent_queries": []
        }

    answered_queries = [
        query for query in project_queries
        if not is_no_answer_record(query)
    ]

    no_answer_queries = [
        query for query in project_queries
        if is_no_answer_record(query)
    ]

    latency_values = [
        query.get("latency_ms", 0)
        for query in project_queries
        if query.get("latency_ms") is not None
    ]

    source_counts = [
        query.get("source_count", len(query.get("sources", [])))
        for query in project_queries
    ]

    model_counter = Counter(
        query.get("model_name", "unknown")
        for query in project_queries
    )

    source_file_counter = Counter()

    for query in project_queries:
        sources = query.get("sources", [])

        for source in sources:
            file_name = source.get("file_name")

            if file_name:
                source_file_counter[file_name] += 1

    recent_queries = sorted(
        project_queries,
        key=lambda query: query.get("created_at", ""),
        reverse=True
    )[:10]

    recent_query_summary = []

    for query in recent_queries:
        recent_query_summary.append({
            "query_id": query.get("id"),
            "question": query.get("question"),
            "status": "no_answer" if is_no_answer_record(query) else "answered",
            "latency_ms": query.get("latency_ms"),
            "source_count": query.get("source_count", len(query.get("sources", []))),
            "model_name": query.get("model_name"),
            "created_at": query.get("created_at")
        })

    answer_rate = round((len(answered_queries) / total_queries) * 100, 2)

    return {
        "project_id": project_id,
        "total_queries": total_queries,
        "answered_queries": len(answered_queries),
        "no_answer_queries": len(no_answer_queries),
        "answer_rate_percentage": answer_rate,
        "average_latency_ms": round(mean(latency_values), 2) if latency_values else 0,
        "average_sources_per_answer": round(mean(source_counts), 2) if source_counts else 0,
        "model_usage": dict(model_counter),
        "most_used_source_files": [
            {
                "file_name": file_name,
                "used_count": count
            }
            for file_name, count in source_file_counter.most_common(10)
        ],
        "recent_queries": recent_query_summary
    }


def get_document_usage(project_id: str):
    project_queries = get_project_queries(project_id)

    document_usage = defaultdict(lambda: {
        "file_name": None,
        "used_count": 0,
        "questions": []
    })

    for query in project_queries:
        question = query.get("question")

        for source in query.get("sources", []):
            file_name = source.get("file_name")

            if not file_name:
                continue

            document_usage[file_name]["file_name"] = file_name
            document_usage[file_name]["used_count"] += 1

            if question and question not in document_usage[file_name]["questions"]:
                document_usage[file_name]["questions"].append(question)

    return {
        "project_id": project_id,
        "documents": sorted(
            document_usage.values(),
            key=lambda item: item["used_count"],
            reverse=True
        )
    }
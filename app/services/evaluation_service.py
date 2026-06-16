import json
from pathlib import Path
from uuid import uuid4
from datetime import datetime
from statistics import mean
from fastapi import HTTPException

from app.db.schemas import EvaluationTestCaseCreate
from app.services.project_service import get_project_by_id
from app.services.chat_service import answer_question


DATA_DIR = Path("data")
EVAL_TEST_CASES_FILE = DATA_DIR / "evaluation_test_cases.json"
EVAL_RUNS_FILE = DATA_DIR / "evaluation_runs.json"


def ensure_evaluation_storage_exists():
    DATA_DIR.mkdir(exist_ok=True)

    if not EVAL_TEST_CASES_FILE.exists():
        EVAL_TEST_CASES_FILE.write_text("[]", encoding="utf-8")

    if not EVAL_RUNS_FILE.exists():
        EVAL_RUNS_FILE.write_text("[]", encoding="utf-8")


def load_eval_test_cases():
    ensure_evaluation_storage_exists()

    with open(EVAL_TEST_CASES_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def save_eval_test_cases(test_cases):
    ensure_evaluation_storage_exists()

    with open(EVAL_TEST_CASES_FILE, "w", encoding="utf-8") as file:
        json.dump(test_cases, file, indent=4)


def load_eval_runs():
    ensure_evaluation_storage_exists()

    with open(EVAL_RUNS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def save_eval_runs(runs):
    ensure_evaluation_storage_exists()

    with open(EVAL_RUNS_FILE, "w", encoding="utf-8") as file:
        json.dump(runs, file, indent=4)


def create_test_case(project_id: str, test_case_data: EvaluationTestCaseCreate):
    project = get_project_by_id(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    test_cases = load_eval_test_cases()

    new_test_case = {
        "id": str(uuid4()),
        "project_id": project_id,
        "question": test_case_data.question,
        "expected_answer_keywords": test_case_data.expected_answer_keywords,
        "expected_source_file": test_case_data.expected_source_file,
        "expected_should_answer": test_case_data.expected_should_answer,
        "top_k": test_case_data.top_k,
        "rewrite_query": test_case_data.rewrite_query,
        "retrieval_mode": test_case_data.retrieval_mode,
        "rerank": test_case_data.rerank,
        "notes": test_case_data.notes,
        "created_at": datetime.utcnow().isoformat()
    }

    test_cases.append(new_test_case)
    save_eval_test_cases(test_cases)

    return new_test_case


def get_test_cases_by_project(project_id: str):
    test_cases = load_eval_test_cases()

    return [
        test_case for test_case in test_cases
        if test_case.get("project_id") == project_id
    ]


def get_selected_test_cases(project_id: str, test_case_ids: list[str] | None = None):
    project_test_cases = get_test_cases_by_project(project_id)

    if not test_case_ids:
        return project_test_cases

    selected_ids = set(test_case_ids)

    return [
        test_case for test_case in project_test_cases
        if test_case.get("id") in selected_ids
    ]


def calculate_keyword_match_score(answer: str, expected_keywords: list[str]) -> dict:
    if not expected_keywords:
        return {
            "keyword_match_score": 1.0,
            "matched_keywords": [],
            "missing_keywords": []
        }

    answer_lower = answer.lower()

    matched_keywords = []
    missing_keywords = []

    for keyword in expected_keywords:
        keyword_lower = keyword.lower().strip()

        if keyword_lower and keyword_lower in answer_lower:
            matched_keywords.append(keyword)
        else:
            missing_keywords.append(keyword)

    score = len(matched_keywords) / len(expected_keywords)

    return {
        "keyword_match_score": round(score, 4),
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords
    }


def check_source_match(sources: list, expected_source_file: str | None) -> dict:
    if not expected_source_file:
        return {
            "source_match_required": False,
            "source_match": True,
            "matched_source_file": None
        }

    expected_lower = expected_source_file.lower().strip()

    for source in sources:
        file_name = str(source.get("file_name", "")).lower()

        if expected_lower in file_name or file_name in expected_lower:
            return {
                "source_match_required": True,
                "source_match": True,
                "matched_source_file": source.get("file_name")
            }

    return {
        "source_match_required": True,
        "source_match": False,
        "matched_source_file": None
    }


def evaluate_single_test_case(project_id: str, test_case: dict):
    response = answer_question(
        project_id=project_id,
        question=test_case["question"],
        top_k=test_case.get("top_k", 3),
        rewrite_enabled=test_case.get("rewrite_query", True),
        retrieval_mode=test_case.get("retrieval_mode", "hybrid"),
        rerank=test_case.get("rerank", True)
    )

    answer = response.get("answer", "")
    status = response.get("status", "unknown")
    sources = response.get("sources", [])

    expected_should_answer = test_case.get("expected_should_answer", True)

    keyword_result = calculate_keyword_match_score(
        answer=answer,
        expected_keywords=test_case.get("expected_answer_keywords", [])
    )

    source_result = check_source_match(
        sources=sources,
        expected_source_file=test_case.get("expected_source_file")
    )

    if expected_should_answer:
        expected_keywords = test_case.get("expected_answer_keywords", [])

        keyword_pass = (
            not expected_keywords
            or keyword_result["keyword_match_score"] >= 0.4
        )

        passed = (
            status == "answered"
            and source_result["source_match"]
            and keyword_pass
        )
    else:
        passed = status == "no_answer"

    failure_reasons = []

    if expected_should_answer and status != "answered":
        failure_reasons.append("Expected an answer but got no_answer")

    if expected_should_answer and not source_result["source_match"]:
        failure_reasons.append("Expected source file was not found in sources")

    if expected_should_answer:
        expected_keywords = test_case.get("expected_answer_keywords", [])
        if expected_keywords and keyword_result["keyword_match_score"] < 0.4:
            failure_reasons.append("Keyword match score is below threshold")

    if not expected_should_answer and status != "no_answer":
        failure_reasons.append("Expected no_answer but system answered")

    return {
        "test_case_id": test_case["id"],
        "question": test_case["question"],
        "expected_should_answer": expected_should_answer,
        "expected_answer_keywords": test_case.get("expected_answer_keywords", []),
        "expected_source_file": test_case.get("expected_source_file"),
        "generated_answer": answer,
        "status": status,
        "confidence": response.get("confidence"),
        "top_similarity_score": response.get("top_similarity_score"),
        "keyword_match_score": keyword_result["keyword_match_score"],
        "matched_keywords": keyword_result["matched_keywords"],
        "missing_keywords": keyword_result["missing_keywords"],
        "source_match": source_result["source_match"],
        "matched_source_file": source_result["matched_source_file"],
        "sources": sources,
        "latency_ms": response.get("latency_ms"),
        "retrieval_mode": response.get("retrieval_mode"),
        "rewrite_query": test_case.get("rewrite_query", True),
        "was_query_rewritten": response.get("was_query_rewritten"),
        "rewritten_query": response.get("rewritten_query"),
        "rerank": response.get("rerank"),
        "passed": passed,
        "failure_reasons": failure_reasons
    }


def run_project_evaluation(project_id: str, test_case_ids: list[str] | None = None):
    project = get_project_by_id(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    test_cases = get_selected_test_cases(
        project_id=project_id,
        test_case_ids=test_case_ids
    )

    if not test_cases:
        raise HTTPException(
            status_code=404,
            detail="No evaluation test cases found for this project"
        )

    run_id = str(uuid4())

    case_results = []

    for test_case in test_cases:
        result = evaluate_single_test_case(
            project_id=project_id,
            test_case=test_case
        )
        case_results.append(result)

    total_cases = len(case_results)
    passed_cases = [result for result in case_results if result["passed"]]
    failed_cases = [result for result in case_results if not result["passed"]]

    latency_values = [
        result.get("latency_ms", 0)
        for result in case_results
        if result.get("latency_ms") is not None
    ]

    keyword_scores = [
        result.get("keyword_match_score", 0)
        for result in case_results
    ]

    answered_count = len([
        result for result in case_results
        if result.get("status") == "answered"
    ])

    no_answer_count = len([
        result for result in case_results
        if result.get("status") == "no_answer"
    ])

    source_match_count = len([
        result for result in case_results
        if result.get("source_match") is True
    ])

    evaluation_run = {
        "id": run_id,
        "project_id": project_id,
        "total_cases": total_cases,
        "passed_cases": len(passed_cases),
        "failed_cases": len(failed_cases),
        "pass_rate_percentage": round((len(passed_cases) / total_cases) * 100, 2),
        "answered_count": answered_count,
        "no_answer_count": no_answer_count,
        "source_match_count": source_match_count,
        "average_latency_ms": round(mean(latency_values), 2) if latency_values else 0,
        "average_keyword_match_score": round(mean(keyword_scores), 4) if keyword_scores else 0,
        "results": case_results,
        "created_at": datetime.utcnow().isoformat()
    }

    runs = load_eval_runs()
    runs.append(evaluation_run)
    save_eval_runs(runs)

    return evaluation_run


def get_evaluation_runs_by_project(project_id: str):
    runs = load_eval_runs()

    project_runs = [
        run for run in runs
        if run.get("project_id") == project_id
    ]

    return sorted(
        project_runs,
        key=lambda run: run.get("created_at", ""),
        reverse=True
    )
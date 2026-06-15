from fastapi import APIRouter, Depends

from app.core.security import verify_api_key, ensure_project_access
from app.db.schemas import EvaluationTestCaseCreate, EvaluationRunRequest
from app.services.evaluation_service import (
    create_test_case,
    get_test_cases_by_project,
    run_project_evaluation,
    get_evaluation_runs_by_project
)

router = APIRouter()


@router.post("/evaluations/{project_id}/test-cases")
def create_project_test_case(
    project_id: str,
    request: EvaluationTestCaseCreate,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return create_test_case(
        project_id=project_id,
        test_case_data=request
    )


@router.get("/evaluations/{project_id}/test-cases")
def list_project_test_cases(
    project_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return get_test_cases_by_project(project_id)


@router.post("/evaluations/{project_id}/run")
def run_evaluation(
    project_id: str,
    request: EvaluationRunRequest,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return run_project_evaluation(
        project_id=project_id,
        test_case_ids=request.test_case_ids
    )


@router.get("/evaluations/{project_id}/runs")
def list_evaluation_runs(
    project_id: str,
    api_key_record: dict = Depends(verify_api_key)
):
    ensure_project_access(api_key_record, project_id)

    return get_evaluation_runs_by_project(project_id)
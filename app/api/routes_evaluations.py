from fastapi import APIRouter, Depends

from app.db.schemas import EvaluationTestCaseCreate, EvaluationRunRequest
from app.services.evaluation_service import (
    create_test_case,
    get_test_cases_by_project,
    run_project_evaluation,
    get_evaluation_runs_by_project
)
from app.api.routes_documents import flexible_auth, check_flexible_project_access

router = APIRouter()


@router.post("/evaluations/{project_id}/test-cases")
def create_project_test_case(
    project_id: str,
    request: EvaluationTestCaseCreate,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)

    return create_test_case(
        project_id=project_id,
        test_case_data=request
    )


@router.get("/evaluations/{project_id}/test-cases")
def list_project_test_cases(
    project_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)

    return get_test_cases_by_project(project_id)


@router.post("/evaluations/{project_id}/run")
def run_evaluation(
    project_id: str,
    request: EvaluationRunRequest,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)

    return run_project_evaluation(
        project_id=project_id,
        test_case_ids=request.test_case_ids
    )


@router.get("/evaluations/{project_id}/runs")
def list_evaluation_runs(
    project_id: str,
    auth_ctx: dict = Depends(flexible_auth)
):
    check_flexible_project_access(auth_ctx, project_id)

    return get_evaluation_runs_by_project(project_id)
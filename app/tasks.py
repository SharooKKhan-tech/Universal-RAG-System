from celery import Celery
from app.core.config import settings
from app.services.background_pipeline_service import process_document_in_background as process_doc_logic

# Initialize Celery application
celery_app = Celery(
    "universal_rag_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

# Optional: configure celery application
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task(name="app.tasks.process_document_task")
def process_document_task(document_id: str):
    """
    Celery task that executes the complete document ingestion pipeline
    (Extraction -> Chunking -> Vector Indexing).
    """
    print(f"[Celery Worker] Starting ingestion process for document ID: {document_id}")
    process_doc_logic(document_id)
    print(f"[Celery Worker] Ingestion process complete for document ID: {document_id}")

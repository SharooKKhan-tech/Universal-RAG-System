from fastapi import HTTPException

from app.services.document_service import get_document_by_id
from app.services.chunk_service import (
    get_chunks_by_document,
    update_document_status
)
from app.embeddings.local_embeddings import embedding_provider
from app.vectorstores.chroma_store import vector_store


def index_document_chunks(document_id: str):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document["status"] not in ["chunked", "indexed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Document is not ready for indexing. Current status: {document['status']}"
        )

    chunks = get_chunks_by_document(document_id)

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail="No chunks found for this document. Please chunk the document first."
        )

    try:
        update_document_status(document_id, "indexing")

        chunk_ids = []
        chunk_texts = []
        metadatas = []

        for chunk in chunks:
            chunk_ids.append(chunk["id"])
            chunk_texts.append(chunk["chunk_text"])

            metadatas.append({
                "project_id": chunk["project_id"],
                "document_id": chunk["document_id"],
                "chunk_index": chunk["chunk_index"],
                "page_number": chunk["page_number"] if chunk["page_number"] else 0,
                "file_name": document["file_name"],
                "file_type": document["file_type"]
            })

        embeddings = embedding_provider.embed_documents(chunk_texts)

        result = vector_store.upsert_chunks(
            ids=chunk_ids,
            documents=chunk_texts,
            embeddings=embeddings,
            metadatas=metadatas
        )

        update_document_status(document_id, "indexed")

        return {
            "message": "Document indexed successfully",
            "document_id": document_id,
            "total_chunks_indexed": result["indexed_count"]
        }

    except Exception as error:
        update_document_status(document_id, "failed", str(error))

        raise HTTPException(
            status_code=500,
            detail=f"Indexing failed: {str(error)}"
        )


def semantic_search(project_id: str, query: str, top_k: int = 5):
    query_embedding = embedding_provider.embed_query(query)

    results = vector_store.search(
        query_embedding=query_embedding,
        project_id=project_id,
        top_k=top_k
    )

    return {
        "query": query,
        "project_id": project_id,
        "top_k": top_k,
        "results": results
    }
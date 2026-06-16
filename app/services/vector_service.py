from fastapi import HTTPException
from app.services.chunk_service import chunk_document
from app.services.document_service import get_document_by_id, update_document_status
from app.services.cache_service import delete_project_chat_cache
from app.services.chunk_service import (
    get_chunks_by_document,
    
)
from app.embeddings.local_embeddings import embedding_provider
from app.vectorstores.chroma_store import vector_store
from app.retrieval.keyword_search import keyword_search_chunks
from app.retrieval.hybrid_search import merge_hybrid_results
from app.retrieval.reranker import rerank_results


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

def keyword_search(
    project_id: str,
    query: str,
    top_k: int = 5
):
    results = keyword_search_chunks(
        project_id=project_id,
        query=query,
        top_k=top_k
    )

    return {
        "query": query,
        "project_id": project_id,
        "top_k": top_k,
        "retrieval_mode": "keyword",
        "results": results
    }


def hybrid_search(
    project_id: str,
    query: str,
    top_k: int = 5
):
    semantic_response = semantic_search(
        project_id=project_id,
        query=query,
        top_k=top_k * 2
    )

    semantic_results = semantic_response.get("results", [])

    keyword_results = keyword_search_chunks(
        project_id=project_id,
        query=query,
        top_k=top_k * 2
    )

    merged_results = merge_hybrid_results(
        semantic_results=semantic_results,
        keyword_results=keyword_results,
        top_k=top_k
    )

    return {
        "query": query,
        "project_id": project_id,
        "top_k": top_k,
        "retrieval_mode": "hybrid",
        "semantic_results_count": len(semantic_results),
        "keyword_results_count": len(keyword_results),
        "results": merged_results
    }


def retrieve_chunks(
    project_id: str,
    query: str,
    top_k: int = 5,
    retrieval_mode: str = "hybrid",
    rerank: bool = True
):
    candidate_top_k = top_k * 3 if rerank else top_k

    if retrieval_mode == "semantic":
        response = semantic_search(
            project_id=project_id,
            query=query,
            top_k=candidate_top_k
        )
        response["retrieval_mode"] = "semantic"

    elif retrieval_mode == "keyword":
        response = keyword_search(
            project_id=project_id,
            query=query,
            top_k=candidate_top_k
        )

    else:
        response = hybrid_search(
            project_id=project_id,
            query=query,
            top_k=candidate_top_k
        )

    results = response.get("results", [])

    if rerank:
        results = rerank_results(
            query=query,
            results=results,
            top_k=top_k
        )
    else:
        results = results[:top_k]

    response["top_k"] = top_k
    response["candidate_top_k"] = candidate_top_k
    response["rerank"] = rerank
    response["results"] = results

    return response
def delete_vectors_for_document(document_id: str):
    chunks = get_chunks_by_document(document_id)

    if chunks:
        chunk_ids = [chunk["id"] for chunk in chunks]

        return vector_store.delete_chunks(chunk_ids)

    return vector_store.delete_document_vectors(document_id)


def reindex_document_chunks(document_id: str):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document["status"] == "failed":
        raise HTTPException(
            status_code=400,
            detail="Cannot re-index a failed document. Upload the document again."
        )

    chunks = get_chunks_by_document(document_id)

    # Delete old vectors first
    delete_vectors_for_document(document_id)

    # If chunks are missing but extracted text exists, chunk again
    if not chunks:
        if document.get("text_path"):
            update_document_status(document_id, "text_extracted")
            chunk_document(document_id)
        else:
            raise HTTPException(
                status_code=400,
                detail="No chunks or extracted text found for this document"
            )

    result = index_document_chunks(document_id)
    delete_project_chat_cache(document["project_id"])
    delete_project_chat_cache(document["project_id"])

    return {
        "message": "Document re-indexed successfully",
        "document_id": document_id,
        "result": result
    }

def delete_vectors_for_document(document_id: str):
    chunks = get_chunks_by_document(document_id)

    if chunks:
        chunk_ids = [chunk["id"] for chunk in chunks]

        return vector_store.delete_chunks(chunk_ids)

    return vector_store.delete_document_vectors(document_id)


def reindex_document_chunks(document_id: str):
    document = get_document_by_id(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document["status"] == "failed":
        raise HTTPException(
            status_code=400,
            detail="Cannot re-index a failed document. Upload the document again."
        )

    chunks = get_chunks_by_document(document_id)

    # Delete old vectors first
    delete_vectors_for_document(document_id)

    # If chunks are missing but extracted text exists, chunk again
    if not chunks:
        if document.get("text_path"):
            update_document_status(document_id, "text_extracted")
            chunk_document(document_id)
        else:
            raise HTTPException(
                status_code=400,
                detail="No chunks or extracted text found for this document"
            )

    result = index_document_chunks(document_id)

    return {
        "message": "Document re-indexed successfully",
        "document_id": document_id,
        "result": result
    }
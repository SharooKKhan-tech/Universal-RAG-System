from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.http import models
from app.core.config import settings

class QdrantVectorStore:
    def __init__(self):
        self.client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT
        )
        self.collection_name = settings.QDRANT_COLLECTION

        self.cache_collection_name = "universal_rag_chat_cache_3072"

        # Check and initialize collections
        try:
            collections = self.client.get_collections().collections
            collection_names = [col.name for col in collections]
            
            # Initialize chunk vector store collection
            if self.collection_name not in collection_names:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=3072,  # Gemini gemini-embedding-2 dimension
                        distance=models.Distance.COSINE
                    )
                )
                
            # Initialize query cache collection
            if self.cache_collection_name not in collection_names:
                self.client.create_collection(
                    collection_name=self.cache_collection_name,
                    vectors_config=models.VectorParams(
                        size=3072,  # Gemini gemini-embedding-2 dimension
                        distance=models.Distance.COSINE
                    )
                )
        except Exception as e:
            # Fallback for transient errors during startup
            print(f"Qdrant startup initialization warning: {e}")

    def upsert_chunks(
        self,
        ids: List[str],
        documents: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]]
    ):
        if not ids:
            return {
                "message": "No chunks to index",
                "indexed_count": 0
            }

        points = []
        for i, doc_id in enumerate(ids):
            # Qdrant requires UUIDs or integers. Chroma uses string IDs (usually UUIDs).
            # If ids[i] is a valid UUID/string, we pass it. If not, Qdrant will raise an error,
            # but all chunk IDs in this system are generated as UUIDv4 strings.
            payload = {
                "chunk_text": documents[i],
                **metadatas[i]
            }
            points.append(
                models.PointStruct(
                    id=doc_id,
                    vector=embeddings[i],
                    payload=payload
                )
            )

        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )

        return {
            "message": "Chunks indexed successfully",
            "indexed_count": len(ids)
        }

    def search(
        self,
        query_embedding: List[float],
        project_id: str,
        top_k: int = 5
    ):
        # Retrieve points matching the project_id payload filter
        search_result = self.client.query_points(
            collection_name=self.collection_name,
            query=query_embedding,
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="project_id",
                        match=models.MatchValue(value=project_id)
                    )
                ]
            ),
            limit=top_k
        )

        return self._format_results(search_result.points)

    def delete_chunks(self, ids: List[str]):
        if not ids:
            return {
                "message": "No vectors to delete",
                "deleted_count": 0
            }

        self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.PointIdsList(
                points=ids
            )
        )

        return {
            "message": "Vectors deleted successfully",
            "deleted_count": len(ids)
        }

    def delete_document_vectors(self, document_id: str):
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_id",
                            match=models.MatchValue(value=document_id)
                        )
                    ]
                )
            )
        )

        return {
            "message": "Document vectors deleted successfully",
            "document_id": document_id
        }

    def _format_results(self, search_results):
        formatted_results = []
        for result in search_results:
            # Map Qdrant scorer distance/score to Chroma-like output structure
            payload = result.payload or {}
            chunk_text = payload.pop("chunk_text", "")
            
            # cosine distance to similarity score
            similarity_score = result.score

            formatted_results.append({
                "chunk_id": str(result.id),
                "chunk_text": chunk_text,
                "metadata": payload,
                "distance": 1.0 - result.score,
                "similarity_score": round(similarity_score, 4)
            })

        return formatted_results

vector_store = QdrantVectorStore()

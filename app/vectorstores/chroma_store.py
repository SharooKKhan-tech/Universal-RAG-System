from typing import List, Dict, Any
from pathlib import Path
import chromadb

CHROMA_DIR = Path("vector_db/chroma")
COLLECTION_NAME = "universal_rag_chunks_cosine"

class ChromaVectorStore:
    def __init__(self):
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)

        self.client = chromadb.PersistentClient(
            path=str(CHROMA_DIR)
        )

        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={
                "hnsw:space": "cosine"
    }
)

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

        self.collection.upsert(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
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
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where={
                "project_id": project_id
            },
            include=[
                "documents",
                "metadatas",
                "distances"
            ]
        )

        return self._format_results(results)

    def delete_chunks(self, ids: List[str]):
        if not ids:
            return {
                "message": "No vectors to delete",
                "deleted_count": 0
            }

        self.collection.delete(ids=ids)

        return {
            "message": "Vectors deleted successfully",
            "deleted_count": len(ids)
        }

    def delete_document_vectors(self, document_id: str):
        self.collection.delete(
            where={
                "document_id": document_id
            }
        )

        return {
            "message": "Document vectors deleted successfully",
            "document_id": document_id
        }

    def _format_results(self, results):
        formatted_results = []

        ids = results.get("ids", [[]])[0]
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for index, chunk_id in enumerate(ids):
            similarity_score = max(0, min(1, 1 - distances[index]))
            formatted_results.append({
                "chunk_id": chunk_id,
                "chunk_text": documents[index],
                "metadata": metadatas[index],
                "distance": distances[index],
                "similarity_score": round(similarity_score, 4)
            })

        return formatted_results


vector_store = ChromaVectorStore()
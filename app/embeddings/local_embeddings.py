from typing import List
from sentence_transformers import SentenceTransformer


class LocalEmbeddingProvider:
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        if hasattr(self.model, "encode_document"):
            embeddings = self.model.encode_document(
                texts,
                normalize_embeddings=True
            )
        else:
            embeddings = self.model.encode(
                texts,
                normalize_embeddings=True
            )

        return embeddings.tolist()

    def embed_query(self, query: str) -> List[float]:
        if hasattr(self.model, "encode_query"):
            embedding = self.model.encode_query(
                query,
                normalize_embeddings=True
            )
        else:
            embedding = self.model.encode(
                query,
                normalize_embeddings=True
            )

        return embedding.tolist()


embedding_provider = LocalEmbeddingProvider()
from typing import List
import requests
from fastapi import HTTPException
from app.core.config import settings

class GeminiEmbeddingProvider:
    def __init__(self, model_name: str = "models/gemini-embedding-2"):
        self.model_name = model_name

    def _get_api_key(self) -> str:
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="Gemini API Key is missing. Please configure it in your environment."
            )
        return api_key

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        api_key = self._get_api_key()
        url = f"https://generativelanguage.googleapis.com/v1beta/{self.model_name}:batchEmbedContents?key={api_key}"

        # batch requests (Gemini API allows batching up to 100 requests per call)
        # We chunk them into batches of 100 to avoid API batch size limit errors
        batch_size = 100
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            chunk_batch = texts[i:i + batch_size]
            requests_payload = []
            
            for text in chunk_batch:
                requests_payload.append({
                    "model": self.model_name,
                    "content": {
                        "parts": [{"text": text}]
                    }
                })

            try:
                response = requests.post(url, json={"requests": requests_payload}, timeout=30)
                response.raise_for_status()
                data = response.json()
                
                for emb in data.get("embeddings", []):
                    all_embeddings.append(emb["values"])
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Gemini API Embeddings error: {str(e)}"
                )

        return all_embeddings

    def embed_query(self, query: str) -> List[float]:
        if not query.strip():
            return []

        api_key = self._get_api_key()
        url = f"https://generativelanguage.googleapis.com/v1beta/{self.model_name}:embedContent?key={api_key}"

        payload = {
            "model": self.model_name,
            "content": {
                "parts": [{"text": query}]
            }
        }

        try:
            response = requests.post(url, json=payload, timeout=20)
            response.raise_for_status()
            data = response.json()
            return data["embedding"]["values"]
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Gemini API Query Embedding error: {str(e)}"
            )

embedding_provider = GeminiEmbeddingProvider()
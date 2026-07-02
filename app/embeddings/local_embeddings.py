from typing import List
import requests
import time
from fastapi import HTTPException
from app.core.config import settings
from app.core.key_rotator import gemini_key_rotator

class GeminiEmbeddingProvider:
    def __init__(self, model_name: str = "models/gemini-embedding-2"):
        self.model_name = model_name

    def _get_api_key(self) -> str:
        api_key = gemini_key_rotator.get_key()
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

            max_retries = 4
            backoff_seconds = 2.0
            success = False
            
            for attempt in range(max_retries):
                try:
                    response = requests.post(url, json={"requests": requests_payload}, timeout=30)
                    response.raise_for_status()
                    data = response.json()
                    
                    for emb in data.get("embeddings", []):
                        all_embeddings.append(emb["values"])
                    success = True
                    break
                except requests.exceptions.HTTPError as http_err:
                    status_code = http_err.response.status_code if http_err.response is not None else 500
                    if status_code in (429, 503) and attempt < max_retries - 1:
                        print(f"[Gemini Embeddings {status_code}] Temporary error. Retrying in {backoff_seconds}s... (Attempt {attempt+1}/{max_retries})")
                        time.sleep(backoff_seconds)
                        backoff_seconds *= 2
                        continue
                    raise HTTPException(
                        status_code=status_code,
                        detail=f"Gemini API Embeddings error: {str(http_err)}"
                    )
                except Exception as e:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Gemini API Embeddings error: {str(e)}"
                    )
            
            if not success:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to generate document embeddings after multiple retries."
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

        max_retries = 4
        backoff_seconds = 2.0

        for attempt in range(max_retries):
            try:
                response = requests.post(url, json=payload, timeout=20)
                response.raise_for_status()
                data = response.json()
                return data["embedding"]["values"]
            except requests.exceptions.HTTPError as http_err:
                status_code = http_err.response.status_code if http_err.response is not None else 500
                if status_code in (429, 503) and attempt < max_retries - 1:
                    print(f"[Gemini Query Embedding {status_code}] Temporary error. Retrying in {backoff_seconds}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(backoff_seconds)
                    backoff_seconds *= 2
                    continue
                raise HTTPException(
                    status_code=status_code,
                    detail=f"Gemini API Query Embedding error: {str(http_err)}"
                )
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Gemini API Query Embedding error: {str(e)}"
                )

        raise HTTPException(
            status_code=500,
            detail="Failed to generate query embedding after multiple retries."
        )

embedding_provider = GeminiEmbeddingProvider()
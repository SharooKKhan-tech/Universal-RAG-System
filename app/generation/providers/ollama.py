import requests
import json
from typing import Iterator
from fastapi import HTTPException

from app.core.config import settings
from app.generation.providers.base import LLMProvider

class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str = settings.OLLAMA_BASE_URL, model_name: str = settings.OLLAMA_MODEL):
        self.base_url = base_url
        self.model_name = model_name

    def generate(self, prompt: str) -> str:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "top_p": 0.9
            }
        }
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "").strip()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Ollama provider failed: {str(e)}"
            )

    def stream(self, prompt: str) -> Iterator[str]:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": 0.2,
                "top_p": 0.9
            }
        }
        try:
            response = requests.post(url, json=payload, stream=True, timeout=60)
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    decoded = line.decode("utf-8")
                    data = json.loads(decoded)
                    token = data.get("response", "")
                    if token:
                        yield token
        except Exception as e:
            yield f"\n[Error: Ollama stream failed - {str(e)}]"

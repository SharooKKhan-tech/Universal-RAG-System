import requests
import json
from typing import Iterator
from fastapi import HTTPException

from app.core.config import settings
from app.generation.providers.base import LLMProvider

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str = None, model_name: str = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.model_name = model_name or settings.OPENAI_MODEL

    def generate(self, prompt: str) -> str:
        if not self.api_key:
            raise HTTPException(
                status_code=400,
                detail="OpenAI API Key is missing. Please configure it in environment."
            )
        
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "stream": False
        }
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"OpenAI provider failed: {str(e)}"
            )

    def stream(self, prompt: str) -> Iterator[str]:
        if not self.api_key:
            yield "[OpenAI API Key is missing. Please configure it in environment.]"
            return
        
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "stream": True
        }
        try:
            response = requests.post(url, json=payload, headers=headers, stream=True, timeout=60)
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    decoded = line.decode("utf-8")
                    if decoded.startswith("data: "):
                        content = decoded[6:].strip()
                        if content == "[DONE]":
                            break
                        try:
                            data = json.loads(content)
                            delta = data["choices"][0]["delta"]
                            if "content" in delta:
                                yield delta["content"]
                        except Exception:
                            continue
        except Exception as e:
            yield f"\n[Error: OpenAI stream failed - {str(e)}]"

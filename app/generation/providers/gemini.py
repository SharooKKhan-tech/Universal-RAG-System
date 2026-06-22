import requests
import json
from typing import Iterator
from fastapi import HTTPException

from app.core.config import settings
from app.generation.providers.base import LLMProvider

class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str = None, model_name: str = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_name = model_name or settings.GEMINI_MODEL

    def generate(self, prompt: str) -> str:
        if not self.api_key:
            raise HTTPException(
                status_code=400,
                detail="Gemini API Key is missing. Please configure it in environment."
            )
        
        # Format the model name if it doesn't have models/ prefix
        model = self.model_name
        if not model.startswith("models/"):
            model = f"models/{model}"
            
        url = f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.2
            }
        }
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Gemini provider failed: {str(e)}"
            )

    def stream(self, prompt: str) -> Iterator[str]:
        if not self.api_key:
            yield "[Gemini API Key is missing. Please configure it in environment.]"
            return
        
        model = self.model_name
        if not model.startswith("models/"):
            model = f"models/{model}"
            
        url = f"https://generativelanguage.googleapis.com/v1beta/{model}:streamGenerateContent?key={self.api_key}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.2
            }
        }
        try:
            response = requests.post(url, json=payload, stream=True, timeout=60)
            response.raise_for_status()
            # The streaming API returns a JSON array or SSE-like text block depending on API version.
            # Usually it returns a JSON list of objects separated by commas or newlines.
            # Let's decode it safely.
            buffer = ""
            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    buffer += chunk.decode("utf-8")
                    # Gemini stream returns objects inside a JSON array, e.g. [ {candidate...}, {candidate...} ]
                    # We can parse candidates on the fly by scanning for JSON objects.
                    # Or we can decode parts as they arrive.
                    # Let's extract candidate parts containing text.
                    # Let's do a simple regex or substring match for "text": "..." to make it super fast and robust!
                    while True:
                        start_idx = buffer.find('"text": "')
                        if start_idx == -1:
                            break
                        end_idx = buffer.find('"', start_idx + 9)
                        if end_idx == -1:
                            break
                        text_val = buffer[start_idx + 9:end_idx]
                        # Clean up escape chars
                        decoded_text = text_val.encode().decode('unicode-escape')
                        yield decoded_text
                        buffer = buffer[end_idx + 1:]
        except Exception as e:
            yield f"\n[Error: Gemini stream failed - {str(e)}]"
            
# Helper decoder logic

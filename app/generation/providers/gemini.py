import requests
import json
import time
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
        
        max_retries = 4
        backoff_seconds = 2.0
        
        for attempt in range(max_retries):
            try:
                response = requests.post(url, json=payload, timeout=60)
                response.raise_for_status()
                data = response.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
            except requests.exceptions.HTTPError as http_err:
                status_code = http_err.response.status_code if http_err.response is not None else 500
                if status_code == 429 and attempt < max_retries - 1:
                    print(f"[Gemini API 429] Rate limit hit. Retrying in {backoff_seconds}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(backoff_seconds)
                    backoff_seconds *= 2
                    continue
                raise HTTPException(
                    status_code=status_code,
                    detail=f"Gemini provider failed: {str(http_err)}"
                )
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
        max_retries = 4
        backoff_seconds = 2.0
        
        for attempt in range(max_retries):
            try:
                response = requests.post(url, json=payload, stream=True, timeout=60)
                response.raise_for_status()
                
                buffer = ""
                brace_count = 0
                start_idx = -1
                
                for chunk in response.iter_content(chunk_size=1024):
                    if not chunk:
                        continue
                    buffer += chunk.decode("utf-8")
                    
                    i = 0
                    while i < len(buffer):
                        char = buffer[i]
                        if char == '{':
                            if brace_count == 0:
                                start_idx = i
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                            if brace_count == 0 and start_idx != -1:
                                # Complete JSON object found
                                obj_str = buffer[start_idx:i+1]
                                try:
                                    obj = json.loads(obj_str)
                                    if "candidates" in obj and obj["candidates"]:
                                        candidate = obj["candidates"][0]
                                        if "content" in candidate and "parts" in candidate["content"]:
                                            text = candidate["content"]["parts"][0].get("text", "")
                                            if text:
                                                yield text
                                except Exception:
                                    pass
                                buffer = buffer[i+1:]
                                i = -1
                                start_idx = -1
                        i += 1
                return  # Success
            except requests.exceptions.HTTPError as http_err:
                status_code = http_err.response.status_code if http_err.response is not None else 500
                if status_code == 429 and attempt < max_retries - 1:
                    print(f"[Gemini Stream 429] Rate limit hit. Retrying in {backoff_seconds}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(backoff_seconds)
                    backoff_seconds *= 2
                    continue
                yield f"\n[Error: Gemini stream failed - {str(http_err)}]"
                return
            except Exception as e:
                yield f"\n[Error: Gemini stream failed - {str(e)}]"
                return
            
# Helper decoder logic

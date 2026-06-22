from typing import Optional
from app.core.config import settings
from app.generation.providers.base import LLMProvider
from app.generation.providers.ollama import OllamaProvider
from app.generation.providers.openai import OpenAIProvider
from app.generation.providers.gemini import GeminiProvider
from app.generation.providers.mock import MockProvider

def get_provider(
    provider_name: str,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None
) -> LLMProvider:
    name = provider_name.lower().strip()
    
    if name == "ollama":
        model = model_name or settings.OLLAMA_MODEL
        return OllamaProvider(model_name=model)
        
    elif name == "openai":
        key = api_key or settings.OPENAI_API_KEY
        model = model_name or settings.OPENAI_MODEL
        return OpenAIProvider(api_key=key, model_name=model)
        
    elif name == "gemini":
        key = api_key or settings.GEMINI_API_KEY
        model = model_name or settings.GEMINI_MODEL
        return GeminiProvider(api_key=key, model_name=model)
        
    elif name == "mock":
        model = model_name or "mock-model"
        return MockProvider(model_name=model)
        
    else:
        # Fallback to Ollama
        return OllamaProvider()

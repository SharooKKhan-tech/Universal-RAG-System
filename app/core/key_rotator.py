import os
from typing import List
from app.core.config import settings

class GeminiKeyRotator:
    def __init__(self):
        # Load raw keys string from env
        keys_str = os.getenv("GEMINI_API_KEYS", "")
        self.keys: List[str] = [k.strip() for k in keys_str.split(",") if k.strip()]
        
        # Fallback to single GEMINI_API_KEY if keys list is empty
        if not self.keys:
            single_key = os.getenv("GEMINI_API_KEY")
            if single_key:
                self.keys = [single_key]
                
        self.index = 0

    def get_key(self) -> str:
        if not self.keys:
            return ""
        # Get current key and advance index round-robin
        key = self.keys[self.index]
        self.index = (self.index + 1) % len(self.keys)
        return key

    def is_configured(self) -> bool:
        return len(self.keys) > 0

gemini_key_rotator = GeminiKeyRotator()

import time
from typing import Iterator
from app.generation.providers.base import LLMProvider

class MockProvider(LLMProvider):
    def __init__(self, model_name: str = "mock-model"):
        self.model_name = model_name

    def generate(self, prompt: str) -> str:
        return f"Mock answer for: '{prompt[:40]}...' using model {self.model_name}."

    def stream(self, prompt: str) -> Iterator[str]:
        tokens = [
            "This ", "is ", "a ", "mocked ", "streaming ", "response ",
            "from ", "the ", "MockProvider ", f"({self.model_name}).\n",
            "It ", "works ", "flawlessly!"
        ]
        for token in tokens:
            time.sleep(0.05)
            yield token

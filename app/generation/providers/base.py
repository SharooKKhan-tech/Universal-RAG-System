from abc import ABC, abstractmethod
from typing import Iterator

class LLMProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str) -> str:
        """
        Synchronously generates response text for a prompt.
        """
        pass

    @abstractmethod
    def stream(self, prompt: str) -> Iterator[str]:
        """
        Streams response tokens/chunks progressively.
        """
        pass

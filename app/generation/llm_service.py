import requests
from fastapi import HTTPException

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "phi3:mini"


def generate_answer_with_ollama(prompt: str) -> str:
    url = f"{OLLAMA_BASE_URL}/api/generate"

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "top_p": 0.9
        }
    }

    try:
        response = requests.post(url, json=payload, timeout=120)
        response.raise_for_status()

        data = response.json()
        return data.get("response", "").strip()

    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running. Please start Ollama and try again."
        )

    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Ollama response timed out. Try again with smaller top_k or shorter documents."
        )

    except requests.exceptions.RequestException as error:
        raise HTTPException(
            status_code=500,
            detail=f"Ollama request failed: {str(error)}"
        )
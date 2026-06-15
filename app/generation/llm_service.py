import requests
from fastapi import HTTPException

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "phi3:mini"


def generate_answer_with_ollama(prompt: str) -> str:
    return generate_text_with_ollama(
        prompt=prompt,
        temperature=0.2,
        timeout=120
    )
    
def generate_text_with_ollama(
    prompt: str,
    temperature: float = 0.1,
    timeout: int = 120
) -> str:
    url = f"{OLLAMA_BASE_URL}/api/generate"

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p": 0.9
        }
    }

    try:
        response = requests.post(url, json=payload, timeout=timeout)
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
            detail="Ollama response timed out."
        )

    except requests.exceptions.RequestException as error:
        raise HTTPException(
            status_code=500,
            detail=f"Ollama request failed: {str(error)}"
        )
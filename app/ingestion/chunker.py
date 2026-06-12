import re
from typing import List, Dict, Optional


def extract_page_number(text: str) -> Optional[int]:
    match = re.search(r"--- Page (\d+) ---", text)
    if match:
        return int(match.group(1))
    return None


def split_text_into_chunks(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 150
) -> List[Dict]:
    """
    Splits extracted document text into overlapping chunks.
    Each chunk keeps approximate page number metadata.
    """

    if not text or not text.strip():
        return []

    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()

    chunks = []
    start = 0
    chunk_index = 0
    current_page = None

    while start < len(text):
        end = start + chunk_size
        chunk_text = text[start:end].strip()

        detected_page = extract_page_number(chunk_text)
        if detected_page:
            current_page = detected_page

        if chunk_text:
            chunks.append({
                "chunk_text": chunk_text,
                "chunk_index": chunk_index,
                "page_number": current_page
            })
            chunk_index += 1

        start = end - chunk_overlap

        if start < 0:
            start = 0

    return chunks
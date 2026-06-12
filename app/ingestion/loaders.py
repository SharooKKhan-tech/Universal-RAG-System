from pathlib import Path
from pypdf import PdfReader


def extract_text_from_pdf(file_path: str) -> str:
    reader = PdfReader(file_path)
    extracted_text = []

    for page_number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""

        if page_text.strip():
            extracted_text.append(
                f"\n--- Page {page_number} ---\n{page_text}"
            )

    return "\n".join(extracted_text)


def extract_text_from_txt(file_path: str) -> str:
    path = Path(file_path)

    return path.read_text(
        encoding="utf-8",
        errors="ignore"
    )


def extract_text_from_file(file_path: str, file_type: str) -> str:
    file_type = file_type.lower()

    if file_type == "pdf":
        return extract_text_from_pdf(file_path)

    if file_type == "txt":
        return extract_text_from_txt(file_path)

    raise ValueError(f"Unsupported file type: {file_type}")
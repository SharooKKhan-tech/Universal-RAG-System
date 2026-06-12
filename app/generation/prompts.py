def build_rag_prompt(question: str, context: str) -> str:
    return f"""
You are a helpful RAG assistant.

Your task:
- Answer the user's question using ONLY the provided context.
- Do not use outside knowledge.
- If the answer is not present in the context, say:
  "I don't have enough information in the uploaded documents to answer this."
- Keep the answer clear and concise.
- Do not mention chunk IDs inside the answer.
- Do not invent facts.

Context:
{context}

Question:
{question}

Answer:
""".strip()
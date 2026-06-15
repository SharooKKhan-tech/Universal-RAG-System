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

def build_query_rewrite_prompt(question: str) -> str:
    return f"""
You are a query rewriting assistant for a RAG system.

Your task:
- Rewrite the user's question into a clear and specific search query.
- Keep the same meaning.
- Do not answer the question.
- Do not add facts that are not implied.
- Expand short or vague questions with useful related terms.
- Return only the rewritten query.
- No bullets.
- No explanation.

Examples:

User question:
What about refund?

Rewritten query:
What is the refund policy, refund eligibility, refund timeline, and refund process?

User question:
leave rules?

Rewritten query:
What are the employee leave rules, leave eligibility, leave approval process, and leave limits?

User question:
password?

Rewritten query:
What is the password policy, password requirements, password reset process, and account security rule?

Now rewrite this question:

User question:
{question}

Rewritten query:
""".strip()
# Use official Python runtime as base image
FROM python:3.11-slim

# Set environment variables to optimize Python runtime and cache paths
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/root/.cache/huggingface

# Install system dependencies required for building python libraries and PDF extraction tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    cmake \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download Sentence Transformer and Cross-Encoder model weights during build time.
# This prevents downloading models during container startup, resulting in instant startup and avoiding timeouts.
RUN python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; \
    print('Pre-loading embedding model...'); SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2'); \
    print('Pre-loading reranker model...'); CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

# Copy the rest of the application files
COPY . .

# Expose port
EXPOSE 8000

# Start command: execute migrations first, then run the FastAPI server
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000

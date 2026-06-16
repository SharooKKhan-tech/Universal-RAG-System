import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    PROJECT_NAME: str = "Universal RAG System"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:root@localhost:5432/universal_rag_db"
    )

    SYNC_DATABASE_URL: str = DATABASE_URL.replace(
        "postgresql+asyncpg",
        "postgresql+psycopg2"
    )

    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_CACHE_TTL_SECONDS: int = int(os.getenv("REDIS_CACHE_TTL_SECONDS", "3600"))

    RATE_LIMIT_REQUESTS_PER_MINUTE: int = int(
        os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "60")
    )

    ESTIMATED_COST_PER_1K_TOKENS: float = float(
        os.getenv("ESTIMATED_COST_PER_1K_TOKENS", "0.0")
    )


settings = Settings()
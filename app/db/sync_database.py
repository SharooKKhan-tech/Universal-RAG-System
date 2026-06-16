from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


sync_engine = create_engine(
    settings.SYNC_DATABASE_URL,
    echo=True,
    future=True
)

SessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False
)


def get_sync_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
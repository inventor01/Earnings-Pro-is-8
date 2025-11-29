from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./driver_ledger.db")

# Configure engine with proper connection pooling for Neon
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Test connections before using them (reconnects if closed)
    pool_size=5,  # Neon recommends smaller pools
    max_overflow=10,  # Allow overflow connections
    connect_args={
        "connect_timeout": 10,  # Connection timeout in seconds
    }
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

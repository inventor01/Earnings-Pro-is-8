from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./driver_ledger.db")

# Configure connect_args based on database type
connect_args = {}
if "postgresql" in DATABASE_URL:
    connect_args["connect_timeout"] = 10

# Configure engine with proper connection pooling
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Test connections before using them (reconnects if closed)
    pool_size=5 if "postgresql" in DATABASE_URL else 1,  # Smaller pools for Neon, 1 for SQLite
    max_overflow=10 if "postgresql" in DATABASE_URL else 0,  # No overflow for SQLite
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

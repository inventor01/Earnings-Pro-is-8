from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL")

# Refuse to start on a throwaway SQLite database when DATABASE_URL is missing.
# Previously this silently fell back to "sqlite:///./driver_ledger.db", which on
# an ephemeral host (e.g. Railway without a persistent DATABASE_URL) is recreated
# empty on every redeploy — silently wiping ALL user data. Fail loudly instead so
# a misconfigured deploy never quietly loses production data. For intentional
# local-only use with throwaway SQLite, set ALLOW_EPHEMERAL_SQLITE=1.
if not DATABASE_URL:
    _allow_sqlite = os.getenv("ALLOW_EPHEMERAL_SQLITE", "").strip().lower() in ("1", "true", "yes")
    if not _allow_sqlite:
        raise RuntimeError(
            "DATABASE_URL is not set. Refusing to start on an ephemeral SQLite "
            "database that would silently lose ALL user data on the next redeploy. "
            "Set DATABASE_URL to your persistent Postgres connection string "
            "(e.g. the Railway Postgres URL). For intentional local-only use with "
            "throwaway SQLite, set ALLOW_EPHEMERAL_SQLITE=1."
        )
    DATABASE_URL = "sqlite:///./driver_ledger.db"
    print(
        "[db] WARNING: DATABASE_URL unset and ALLOW_EPHEMERAL_SQLITE enabled — "
        "using local throwaway SQLite (driver_ledger.db). This is for local dev "
        "ONLY and will lose data on redeploy. Do NOT use in production."
    )

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

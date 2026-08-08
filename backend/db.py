from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import ipaddress
import os
import re
from urllib.parse import urlparse

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

# TLS enforcement for Postgres (security audit M-2). sslmode values that
# guarantee an encrypted channel; disable/allow/prefer can silently fall back
# to plaintext and are rejected in normal operation.
_TLS_SAFE_SSLMODES = {"require", "verify-ca", "verify-full"}


def _is_local_db_host(url: str) -> bool:
    """A host is 'local' only when it's a loopback address, 'localhost', or a
    dot-less non-IP internal hostname (e.g. Replit's built-in Postgres proxy
    'helium'). IP literals (v4 or v6) are never inferred local unless they are
    loopback — a remote IPv6 literal has no dots but is NOT local. Every real
    production Postgres (Neon, Railway, RDS...) uses a fully-qualified domain,
    so TLS enforcement applies to any dotted hostname and any non-loopback IP."""
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    if not host:
        return False
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        pass  # not an IP literal — fall through to hostname heuristic
    return "." not in host


def resolve_postgres_sslmode(url: str, allow_insecure: bool = False):
    """Decide TLS enforcement for a Postgres URL.

    Returns "require" when the URL has no sslmode and TLS must be injected,
    None when the URL's own (TLS-safe) sslmode should be honored, the host is
    local (loopback / dot-less internal hostname), or the insecure escape
    hatch is active. Raises RuntimeError for explicit non-TLS-enforcing
    sslmodes (disable/allow/prefer) on remote hosts without the escape hatch.
    """
    m = re.search(r"[?&]sslmode=([a-zA-Z-]+)", url)
    url_sslmode = m.group(1).lower() if m else None
    if allow_insecure or _is_local_db_host(url):
        return None
    if url_sslmode is None:
        return "require"
    if url_sslmode not in _TLS_SAFE_SSLMODES:
        raise RuntimeError(
            f"DATABASE_URL specifies sslmode={url_sslmode}, which does not "
            "guarantee TLS. Use sslmode=require, verify-ca, or verify-full. "
            "For intentional non-TLS local-only Postgres, set ALLOW_INSECURE_DB=1."
        )
    return None


# Configure connect_args based on database type
connect_args = {}
if "postgresql" in DATABASE_URL:
    connect_args["connect_timeout"] = 10
    # Enforce TLS at startup. ALLOW_INSECURE_DB=1 is the local-only escape
    # hatch — never set it in production.
    _allow_insecure = os.getenv("ALLOW_INSECURE_DB", "").strip().lower() in ("1", "true", "yes")
    _injected_sslmode = resolve_postgres_sslmode(DATABASE_URL, _allow_insecure)
    if _injected_sslmode:
        connect_args["sslmode"] = _injected_sslmode

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

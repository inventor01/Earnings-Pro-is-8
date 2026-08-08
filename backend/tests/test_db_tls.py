"""Security-audit M-2: Postgres connections must guarantee TLS. Exercises the
real decision function `backend.db.resolve_postgres_sslmode` (the same one the
engine setup calls at import) plus the live engine's connect_args."""
import os

import pytest

import backend.db as db


def test_remote_url_without_sslmode_injects_require():
    assert db.resolve_postgres_sslmode("postgresql://u:p@db.example.com/db") == "require"


@pytest.mark.parametrize("mode", ["require", "verify-ca", "verify-full"])
def test_tls_safe_explicit_sslmodes_honored(mode):
    assert db.resolve_postgres_sslmode(f"postgresql://u:p@db.example.com/db?sslmode={mode}") is None


@pytest.mark.parametrize("mode", ["disable", "allow", "prefer"])
def test_non_tls_sslmodes_rejected_for_remote_hosts(mode):
    with pytest.raises(RuntimeError, match="guarantee TLS"):
        db.resolve_postgres_sslmode(f"postgresql://u:p@db.example.com/db?sslmode={mode}")


def test_sslmode_detected_after_other_query_params():
    with pytest.raises(RuntimeError):
        db.resolve_postgres_sslmode("postgresql://u:p@db.example.com/db?application_name=x&sslmode=disable")


@pytest.mark.parametrize("mode", ["disable", "allow", "prefer"])
def test_remote_ipv6_unsafe_sslmodes_rejected(mode):
    # IPv6 literals have no dots but are remote — must NOT be treated local.
    with pytest.raises(RuntimeError, match="guarantee TLS"):
        db.resolve_postgres_sslmode(f"postgresql://u:p@[2001:db8::1]:5432/db?sslmode={mode}")


def test_remote_ipv6_without_sslmode_injects_require():
    assert db.resolve_postgres_sslmode("postgresql://u:p@[2001:db8::1]:5432/db") == "require"


def test_remote_ipv4_without_sslmode_injects_require():
    assert db.resolve_postgres_sslmode("postgresql://u:p@203.0.113.7/db") == "require"
    with pytest.raises(RuntimeError):
        db.resolve_postgres_sslmode("postgresql://u:p@203.0.113.7/db?sslmode=disable")


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "[::1]", "helium"])
def test_local_hosts_exempt_from_enforcement(host):
    # Replit's built-in Postgres proxy (dot-less internal hostname) and
    # loopback ship sslmode=disable — local traffic, no TLS to enforce.
    assert db.resolve_postgres_sslmode(f"postgresql://u:p@{host}/db?sslmode=disable") is None
    assert db.resolve_postgres_sslmode(f"postgresql://u:p@{host}/db") is None


def test_escape_hatch_permits_insecure():
    assert db.resolve_postgres_sslmode(
        "postgresql://u:p@host/db?sslmode=disable", allow_insecure=True
    ) is None
    assert db.resolve_postgres_sslmode(
        "postgresql://u:p@host/db", allow_insecure=True
    ) is None


def test_live_engine_enforces_tls_when_postgres():
    """When the suite runs against a Postgres DATABASE_URL (the default dev
    setup), the actual engine must carry TLS: either injected sslmode=require
    or an explicit TLS-safe sslmode in the URL (which import-time enforcement
    already validated — the module would have refused to load otherwise)."""
    url = str(db.engine.url)
    if not url.startswith("postgresql"):
        return  # sqlite dev fallback — nothing to assert
    env_url = os.getenv("DATABASE_URL") or ""
    allow_insecure = os.getenv("ALLOW_INSECURE_DB", "").strip().lower() in ("1", "true", "yes")
    if allow_insecure:
        return
    if "sslmode=" in env_url:
        # Import succeeded, so the explicit mode passed the TLS-safe check.
        return
    assert db.connect_args.get("sslmode") == "require"

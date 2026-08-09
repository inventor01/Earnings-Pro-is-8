"""Shared safety guards for the backend test suite.

A test once emailed the real support inbox ~10 times because the dev
environment holds live secrets (RESEND_API_KEY etc.) and the test exercised
the real handler. These autouse fixtures make that class of accident
impossible for EVERY test in this suite:

1. Live email/service secrets are blanked from the environment (and the
   already-imported module-level mirrors in email_service are blanked too).
2. resend.Emails.send is replaced with a stub that raises, so any code path
   that still reaches the Resend SDK fails loudly instead of sending.
3. Outbound network connections to non-loopback hosts are blocked at the
   socket layer. A test that genuinely needs the network can opt out with
   the `allow_outbound_network` marker:  @pytest.mark.allow_outbound_network
"""
import os
import socket

import pytest

# Secrets that must never be live inside a test run.
_BLANKED_ENV_VARS = [
    "RESEND_API_KEY",
    "RESEND_FROM",
    "BUG_REPORT_EMAIL",
    "SUPPORT_EMAIL",
]

_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0", ""}


class OutboundNetworkBlockedError(RuntimeError):
    pass


def _host_of(address) -> str:
    # AF_INET/AF_INET6 addresses are (host, port, ...) tuples; AF_UNIX is a str.
    if isinstance(address, tuple) and address:
        return str(address[0])
    return ""  # unix sockets etc. are local — allow


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "allow_outbound_network: allow this test to open real network connections",
    )


@pytest.fixture(autouse=True)
def _no_live_email(monkeypatch):
    """Blank live email secrets and make the Resend SDK unusable."""
    for var in _BLANKED_ENV_VARS:
        monkeypatch.delenv(var, raising=False)

    # email_service snapshots env vars at import time — blank the mirrors too.
    from backend.services import email_service
    monkeypatch.setattr(email_service, "RESEND_API_KEY", "", raising=False)

    import resend
    monkeypatch.setattr(resend, "api_key", "", raising=False)

    def _blocked_send(*args, **kwargs):
        raise OutboundNetworkBlockedError(
            "Tests must never send real email: resend.Emails.send was called. "
            "Stub the calling function (e.g. monkeypatch the send helper) instead."
        )

    monkeypatch.setattr(resend.Emails, "send", staticmethod(_blocked_send))
    yield


@pytest.fixture(autouse=True)
def _no_outbound_network(request, monkeypatch):
    """Block real outbound connections unless the test opts in explicitly."""
    if request.node.get_closest_marker("allow_outbound_network"):
        yield
        return

    real_connect = socket.socket.connect
    real_connect_ex = socket.socket.connect_ex
    real_create_connection = socket.create_connection

    def _guard(address):
        host = _host_of(address)
        if host not in _LOOPBACK_HOSTS:
            raise OutboundNetworkBlockedError(
                f"Tests must not touch live services: outbound connection to "
                f"{host!r} blocked. Mark the test with "
                f"@pytest.mark.allow_outbound_network if this is intentional."
            )

    def connect(self, address):
        _guard(address)
        return real_connect(self, address)

    def connect_ex(self, address):
        _guard(address)
        return real_connect_ex(self, address)

    def create_connection(address, *args, **kwargs):
        _guard(address)
        return real_create_connection(address, *args, **kwargs)

    monkeypatch.setattr(socket.socket, "connect", connect)
    monkeypatch.setattr(socket.socket, "connect_ex", connect_ex)
    monkeypatch.setattr(socket, "create_connection", create_connection)
    yield

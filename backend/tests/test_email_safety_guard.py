"""Regression tests: the conftest autouse guards must keep every test in this
suite from emailing real people or touching live services."""
import os
import socket

import pytest
import resend

from backend.services import email_service
from backend.tests.conftest import OutboundNetworkBlockedError


def test_resend_key_is_blanked():
    assert os.environ.get("RESEND_API_KEY") is None
    assert email_service.RESEND_API_KEY == ""
    assert resend.api_key in ("", None)


def test_resend_send_is_stubbed_and_raises():
    with pytest.raises(OutboundNetworkBlockedError):
        resend.Emails.send({"from": "a@b.c", "to": ["x@y.z"], "subject": "s", "html": "h"})


@pytest.mark.asyncio
async def test_email_service_send_returns_false_without_sending():
    # With the key blanked, every send helper takes the no-key branch.
    assert await email_service.send_welcome_email("victim@example.com") is False
    assert await email_service.send_mfa_code_email("victim@example.com", "123456") is False


def test_outbound_network_is_blocked():
    with pytest.raises(OutboundNetworkBlockedError):
        socket.create_connection(("example.com", 443), timeout=1)
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        with pytest.raises(OutboundNetworkBlockedError):
            s.connect(("93.184.216.34", 80))
    finally:
        s.close()


def test_loopback_still_allowed():
    # Loopback must remain usable (in-process test servers); a refused
    # connection is fine — it just must not be blocked by the guard.
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    try:
        s.connect_ex(("127.0.0.1", 1))  # must not raise OutboundNetworkBlockedError
    finally:
        s.close()

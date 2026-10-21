"""Shared test configuration.

The CSRF middleware (``app.security.http``) rejects cookie-authenticated mutations
without ``Origin``/``Referer``, exactly like a production browser request would be
treated. Real browsers always send ``Origin`` on ``fetch`` mutations, so the test
client mimics a same-origin browser by sending ``Origin: http://testserver`` (the
TestClient host). This does not relax the rule: same-origin is trusted in every
environment, and tests that need a foreign or missing origin override the header.
"""

import pytest
from fastapi.testclient import TestClient

TEST_ORIGIN = "http://testserver"
_original_init = TestClient.__init__


def _init_with_browser_origin(self, *args, headers=None, **kwargs):
    merged = {"Origin": TEST_ORIGIN, **dict(headers or {})}
    _original_init(self, *args, headers=merged, **kwargs)


TestClient.__init__ = _init_with_browser_origin


# Public address used for reserved test domains (RFC 2606 ``.test``) so the SSRF guard
# can be exercised offline and deterministically. Tests never perform real DNS lookups.
FAKE_PUBLIC_ADDRESS = "93.184.216.34"


@pytest.fixture(autouse=True)
def offline_dns(monkeypatch):
    import app.security.outbound as outbound

    def fake_resolve(host, port):
        if host.endswith(".test"):
            return [FAKE_PUBLIC_ADDRESS]
        raise OSError("DNS desativado nos testes")

    monkeypatch.setattr(outbound, "resolve_host", fake_resolve)
    return fake_resolve

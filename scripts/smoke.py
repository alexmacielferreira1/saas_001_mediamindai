"""Verify actual HTTP services; deliberately excludes business/authentication claims."""

import json
from urllib.request import urlopen

from app.core.config import get_settings


def main():
    settings = get_settings()
    for route in ("health", "version", "ready"):
        with urlopen(f"http://127.0.0.1:{settings.api_port}/{route}", timeout=5) as response:
            data = json.load(response)
        assert data["service"] == settings.app_name, "Unexpected service on configured port"
        if route == "version":
            assert data["version"] == settings.version
        if route == "ready":
            assert data["database"] == "ok"
        print(f"PASS /{route}")
    with urlopen(f"http://127.0.0.1:{settings.frontend_port}/", timeout=5) as response:
        assert response.status == 200
        assert b'id="root"' in response.read(), "Frontend shell missing"
    print("PASS frontend HTTP shell (not a login or functional parity test)")


if __name__ == "__main__":
    main()

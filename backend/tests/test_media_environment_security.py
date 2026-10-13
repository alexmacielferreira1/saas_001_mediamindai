from types import SimpleNamespace

import pytest
from app.api.v1 import media
from app.core.errors import PublicError


@pytest.mark.parametrize("environment", ["production", "staging", "", "unknown"])
def test_unauthenticated_local_media_is_not_available_outside_local_or_test(
    monkeypatch, environment
):
    monkeypatch.setattr(media, "get_settings", lambda: SimpleNamespace(environment=environment))
    with pytest.raises(PublicError) as caught:
        media.require_local_media()
    assert caught.value.code == "NOT_FOUND"


@pytest.mark.parametrize("environment", ["local", "test"])
def test_explicit_local_environments_keep_local_media(monkeypatch, environment):
    monkeypatch.setattr(media, "get_settings", lambda: SimpleNamespace(environment=environment))
    assert media.require_local_media() is None

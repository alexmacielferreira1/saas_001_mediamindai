import sys
from io import BytesIO
from types import SimpleNamespace

import pytest
from app.core.errors import PublicError
from app.services import background_removal as removal
from PIL import Image


def opaque_png():
    output = BytesIO()
    Image.new("RGB", (4, 4), "red").save(output, format="PNG")
    return output.getvalue()


def test_model_validation_and_session_cache(monkeypatch):
    calls = []
    monkeypatch.setitem(
        sys.modules,
        "rembg",
        SimpleNamespace(new_session=lambda model: calls.append(model) or model),
    )
    removal.get_background_removal_session.cache_clear()
    try:
        with pytest.raises(PublicError):
            removal.get_background_removal_session("untrusted")
        assert removal.get_background_removal_session("u2netp") == "u2netp"
        assert removal.get_background_removal_session("u2netp") == "u2netp"
        assert calls == ["u2netp"]
    finally:
        removal.get_background_removal_session.cache_clear()


def test_empty_cutout_is_rejected():
    with pytest.raises(PublicError):
        removal.transparent_png(Image.new("RGBA", (4, 4), (0, 0, 0, 0)))


def test_busy_processor_rejects_without_releasing_another_job():
    assert removal._processing.acquire(blocking=False)
    try:
        with pytest.raises(PublicError):
            removal.remove_image_background(opaque_png())
        assert not removal._processing.acquire(blocking=False)
    finally:
        removal._processing.release()


@pytest.mark.parametrize(
    "failure", [None, ValueError("engine failure"), PublicError(422, "INVALID_MODEL", "Invalid")]
)
def test_processor_releases_capacity_on_success_and_failure(monkeypatch, failure):
    def process(image, **options):
        assert options == {"session": "session", "alpha_matting": False}
        if failure:
            raise failure
        result = image.copy()
        result.putalpha(128)
        return result

    monkeypatch.setitem(sys.modules, "rembg", SimpleNamespace(remove=process))
    monkeypatch.setattr(removal, "get_background_removal_session", lambda model: "session")
    if failure:
        with pytest.raises(PublicError) as caught:
            removal.remove_image_background(opaque_png())
        if isinstance(failure, PublicError):
            assert caught.value is failure
    else:
        result = removal.remove_image_background(opaque_png())
        with Image.open(BytesIO(result)) as image:
            assert image.mode == "RGBA"
            assert image.getchannel("A").getextrema() == (128, 128)
    assert removal._processing.acquire(blocking=False)
    removal._processing.release()

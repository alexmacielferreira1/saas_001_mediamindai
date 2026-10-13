from io import BytesIO

import pytest
from app.api.v1 import media
from app.core.errors import PublicError
from app.services import background_removal
from starlette.datastructures import Headers, UploadFile


@pytest.mark.anyio
@pytest.mark.parametrize(
    "content, limit, code", [(b"", 10, "EMPTY_IMAGE"), (b"123456", 5, "FILE_TOO_LARGE")]
)
async def test_thumbnail_input_limits_reject_before_processing(monkeypatch, content, limit, code):
    monkeypatch.setattr(media, "THUMBNAIL_IMAGE_LIMIT", limit)
    upload = UploadFile(
        BytesIO(content), filename="portrait.png", headers=Headers({"content-type": "image/png"})
    )
    try:
        with pytest.raises(PublicError) as caught:
            await media.read_thumbnail_image(upload)
        assert caught.value.code == code
    finally:
        await upload.close()


def test_oversized_decoded_image_is_rejected_before_loading_pixels(monkeypatch):
    class OversizedImage:
        width = 6000
        height = 4001

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def load(self):
            pytest.fail("Oversized image must not be decoded")

    monkeypatch.setattr(background_removal.Image, "open", lambda stream: OversizedImage())
    with pytest.raises(PublicError) as caught:
        background_removal.normalized_image(b"image")
    assert caught.value.code == "IMAGE_TOO_LARGE"

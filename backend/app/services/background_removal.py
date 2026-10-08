from functools import lru_cache
from io import BytesIO
from threading import BoundedSemaphore

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import PublicError

_processing = BoundedSemaphore(1)
Image.MAX_IMAGE_PIXELS = 24_000_000


@lru_cache(maxsize=2)
def get_background_removal_session(model: str = "isnet-general-use"):
    from rembg import new_session

    if model not in {"isnet-general-use", "u2netp"}:
        raise PublicError(422, "INVALID_MODEL", "Modelo de recorte não permitido.")
    return new_session(model)


def normalized_image(content: bytes) -> Image.Image:
    try:
        with Image.open(BytesIO(content)) as source:
            if source.width * source.height > 24_000_000:
                raise PublicError(413, "IMAGE_TOO_LARGE", "A foto deve ter até 24 megapixels.")
            source.load()
            return ImageOps.exif_transpose(source).convert("RGBA")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise PublicError(422, "INVALID_IMAGE", "Não foi possível ler a imagem enviada.") from error


def transparent_png(image: Image.Image) -> bytes:
    box = image.getchannel("A").getbbox()
    if not box:
        raise PublicError(422, "EMPTY_CUTOUT", "O recorte ficou vazio. Revise a foto original.")
    output = BytesIO()
    image.crop(box).save(output, format="PNG")
    return output.getvalue()


def remove_image_background(content: bytes, model: str = "isnet-general-use") -> bytes:
    image = normalized_image(content)
    # Existing transparent PNGs are kept and only empty margins are removed.
    if image.getchannel("A").getextrema()[0] < 255:
        return transparent_png(image)
    if not _processing.acquire(blocking=False):
        raise PublicError(
            429, "CUTOUT_BUSY", "Há um recorte em andamento. Tente novamente.", retryable=True
        )
    try:
        from rembg import remove

        result = remove(image, session=get_background_removal_session(model), alpha_matting=False)
        return transparent_png(result.convert("RGBA"))
    except PublicError:
        raise
    except Exception as error:
        raise PublicError(
            503,
            "CUTOUT_UNAVAILABLE",
            "Recorte local indisponível. Verifique rembg, memória e o modelo no servidor.",
            retryable=True,
        ) from error
    finally:
        _processing.release()

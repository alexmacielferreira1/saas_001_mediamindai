from functools import lru_cache


@lru_cache(maxsize=1)
def get_background_removal_session():
    from rembg import new_session

    # IS-Net is explicitly selected: it has a permissive license and produces
    # substantially cleaner hair/clothing edges than the previous color flood-fill.
    return new_session("isnet-general-use")


def remove_image_background(content: bytes) -> bytes:
    from rembg import remove

    return remove(
        content,
        session=get_background_removal_session(),
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=8,
    )

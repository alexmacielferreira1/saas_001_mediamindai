import subprocess
from io import BytesIO
from types import SimpleNamespace

import pytest
from app.api.v1 import media
from app.core.errors import PublicError
from fastapi import UploadFile


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        ("bytes=2-5", (2, 5)),
        ("bytes=3-", (3, 9)),
        ("bytes=-4", (6, 9)),
        ("bytes=0-99", (0, 9)),
    ],
)
def test_byte_range_parser_supports_explicit_open_and_suffix_ranges(header, expected):
    assert media.parse_byte_range(header, 10) == expected


@pytest.mark.parametrize(
    "header",
    ["items=0-1", "bytes=0-1,3-4", "bytes=0", "bytes=-0", "bytes=10-", "bytes=5-4"],
)
def test_byte_range_parser_rejects_malformed_or_unsatisfiable_ranges(header):
    with pytest.raises(ValueError):
        media.parse_byte_range(header, 10)


def test_range_iterator_yields_only_requested_bytes_in_bounded_chunks(tmp_path):
    source = tmp_path / "source.bin"
    source.write_bytes(b"0123456789")

    assert list(media.iter_file_range(source, 2, 8, chunk_size=3)) == [b"234", b"567", b"8"]


def test_range_iterator_stops_cleanly_if_source_is_shorter_than_requested(tmp_path):
    source = tmp_path / "short.bin"
    source.write_bytes(b"abc")

    assert list(media.iter_file_range(source, 0, 99, chunk_size=2)) == [b"ab", b"c"]


def test_trim_clip_drops_clips_outside_selected_sequence_range():
    assert (
        media.trim_clip_to_export_range({"start": 1, "duration": 2}, in_point=4, out_point=8)
        is None
    )


@pytest.mark.parametrize(("speed", "expected"), [(0.01, 0.25), (10, 4)])
def test_trim_clip_clamps_playback_speed(speed, expected):
    result = media.trim_clip_to_export_range(
        {"start": 0, "duration": 2, "properties": {"speed": speed}},
        in_point=0,
        out_point=2,
    )

    assert result["duration"] == 2 * expected


def test_render_plan_does_not_insert_gap_for_overlapping_clips_and_accounts_for_speed():
    plan = media.build_timeline_render_plan(
        [
            {"timeline_start": 0, "duration": 4, "properties": {"speed": 2}},
            {"timeline_start": 1, "duration": 1, "properties": {"speed": 1}},
        ]
    )

    assert [segment["kind"] for segment in plan] == ["media", "media"]
    assert plan[0]["duration"] == 4


@pytest.mark.parametrize(
    ("filename", "content_type", "expected"),
    [
        ("voice.WAV", "audio/wav", (".wav", "audio")),
        ("photo.webp", "image/webp", (".webp", "image")),
        ("clip.MP4", "video/mp4", (".mp4", "video")),
    ],
)
def test_classify_upload_normalizes_supported_extensions(filename, content_type, expected):
    upload = SimpleNamespace(filename=filename, content_type=content_type)

    assert media.classify_upload(upload) == expected


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [("payload.exe", "application/octet-stream"), ("movie.mp4", "text/plain")],
)
def test_classify_upload_rejects_extension_or_mime_mismatch(filename, content_type):
    upload = SimpleNamespace(filename=filename, content_type=content_type)

    with pytest.raises(PublicError) as caught:
        media.classify_upload(upload)

    assert caught.value.code == "INVALID_MEDIA_TYPE"


@pytest.mark.parametrize(
    ("content_type", "content", "error_code"),
    [
        ("image/gif", b"gif", "IMAGE_REQUIRED"),
        ("image/png", b"", "EMPTY_IMAGE"),
    ],
)
def test_thumbnail_reader_rejects_unsupported_empty_and_oversize_files(
    content_type, content, error_code, monkeypatch
):
    upload = UploadFile(
        BytesIO(content), filename="photo.png", headers={"content-type": content_type}
    )

    with pytest.raises(PublicError) as caught:
        awaitable_media_read(upload)

    assert caught.value.code == error_code


def test_thumbnail_reader_rejects_oversize_file(monkeypatch):
    monkeypatch.setattr(media, "THUMBNAIL_IMAGE_LIMIT", 8)
    upload = UploadFile(
        BytesIO(b"x" * 9), filename="photo.jpg", headers={"content-type": "image/jpeg"}
    )

    with pytest.raises(PublicError) as caught:
        awaitable_media_read(upload)

    assert caught.value.code == "FILE_TOO_LARGE"


def test_thumbnail_reader_returns_valid_image_bytes():
    upload = UploadFile(
        BytesIO(b"png-bytes"), filename="photo.png", headers={"content-type": "image/png"}
    )

    assert awaitable_media_read(upload) == b"png-bytes"


def awaitable_media_read(upload):
    import asyncio

    return asyncio.run(media.read_thumbnail_image(upload))


@pytest.mark.parametrize("payload", ["{bad", "{}", "null", "false"])
def test_local_catalog_returns_empty_for_invalid_or_wrong_shaped_json(
    tmp_path, monkeypatch, payload
):
    monkeypatch.setattr(media, "local_catalog_path", lambda: tmp_path / "assets.json")
    (tmp_path / "assets.json").write_text(payload, encoding="utf-8")

    assert media.load_local_catalog() == []


def test_local_catalog_save_replaces_file_atomically_without_part_leftovers(tmp_path, monkeypatch):
    target = tmp_path / "assets.json"
    monkeypatch.setattr(media, "local_catalog_path", lambda: target)

    media.save_local_catalog([{"id": "asset-1"}])

    assert media.load_local_catalog() == [{"id": "asset-1"}]
    assert not (tmp_path / "assets.json.part").exists()


def test_local_media_is_hidden_outside_local_and_test_environments(monkeypatch):
    monkeypatch.setattr(media, "get_settings", lambda: SimpleNamespace(environment="production"))

    with pytest.raises(PublicError) as caught:
        media.require_local_media()

    assert caught.value.status == 404
    assert caught.value.code == "NOT_FOUND"


def test_find_ffmpeg_prefers_configured_executable(tmp_path, monkeypatch):
    executable = tmp_path / "ffmpeg.exe"
    executable.touch()
    monkeypatch.setattr(
        media,
        "get_settings",
        lambda: SimpleNamespace(ffmpeg_path=executable, media_root=tmp_path / "a" / "b"),
    )
    monkeypatch.setattr(media.shutil, "which", lambda _name: None)

    assert media.find_ffmpeg() == executable


def test_timeline_concat_failure_removes_partial_export(tmp_path, monkeypatch):
    destination = tmp_path / "timeline.mp4"
    monkeypatch.setattr(media, "find_ffmpeg", lambda: tmp_path / "ffmpeg.exe")

    def write_segment(_source, path, **_options):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"segment")

    monkeypatch.setattr(media, "render_media_clip", write_segment)

    def fail_concat(_command, **_options):
        destination.write_bytes(b"partial")
        raise subprocess.CalledProcessError(1, "ffmpeg")

    monkeypatch.setattr(media.subprocess, "run", fail_concat)
    segments = [
        {
            "source": tmp_path / "source.mp4",
            "source_in": 0,
            "duration": 1,
            "timeline_start": 0,
            "properties": {},
        }
    ]

    with pytest.raises(PublicError) as caught:
        media.render_timeline(segments, destination)

    assert caught.value.code == "EXPORT_FAILED"
    assert not destination.exists()

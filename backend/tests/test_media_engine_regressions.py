import json
import subprocess
from types import SimpleNamespace

import pytest
from app.api.v1 import media
from app.core.errors import PublicError


@pytest.mark.parametrize(
    "payload, expected",
    [
        (
            {
                "format": {"duration": "12.3456"},
                "streams": [
                    {"codec_type": "audio"},
                    {
                        "codec_type": "video",
                        "width": 1920,
                        "height": 1080,
                        "r_frame_rate": "30000/1001",
                    },
                ],
            },
            {"duration": 12.346, "width": 1920, "height": 1080, "fps": 29.97},
        ),
        ({}, {"duration": 0.0}),
        (
            {"streams": [{"codec_type": "video", "r_frame_rate": "24"}]},
            {"duration": 0.0, "fps": 24.0},
        ),
        ({"format": {"duration": "invalid"}}, {}),
        ({"format": {"duration": []}}, {}),
    ],
)
def test_probe_normalizes_metadata_without_exposing_raw_output(
    tmp_path, monkeypatch, payload, expected
):
    executable = tmp_path / "ffmpeg.exe"
    (tmp_path / "ffprobe.exe").touch()
    monkeypatch.setattr(media, "find_ffmpeg", lambda: executable)
    monkeypatch.setattr(
        media.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout=json.dumps(payload)),
    )
    assert media.probe_media(tmp_path / "source.mp4") == expected


@pytest.mark.parametrize(
    "outcome", ["missing_engine", "missing_probe", "failed_probe", "invalid_json"]
)
def test_probe_unavailable_returns_empty_metadata(tmp_path, monkeypatch, outcome):
    def engine():
        if outcome == "missing_engine":
            raise PublicError(503, "FFMPEG_UNAVAILABLE", "Unavailable")
        return tmp_path / "ffmpeg"

    monkeypatch.setattr(media, "find_ffmpeg", engine)
    if outcome != "missing_probe":
        (tmp_path / "ffprobe").touch()
    monkeypatch.setattr(
        media.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(
            returncode=1 if outcome == "failed_probe" else 0, stdout="not json"
        ),
    )
    assert media.probe_media(tmp_path / "source.mp4") == {}


@pytest.mark.parametrize(
    "failure, code",
    [
        (subprocess.TimeoutExpired("ffmpeg", 1), "EXPORT_TIMEOUT"),
        (subprocess.CalledProcessError(1, "ffmpeg"), "EXPORT_FAILED"),
    ],
)
def test_clip_render_failure_removes_partial_output(tmp_path, monkeypatch, failure, code):
    destination = tmp_path / "output.mp4"
    monkeypatch.setattr(media, "find_ffmpeg", lambda: tmp_path / "ffmpeg")

    def render(command, **options):
        assert "-itsscale" in command
        assert options["check"] is True
        destination.write_bytes(b"partial")
        raise failure

    monkeypatch.setattr(media.subprocess, "run", render)
    with pytest.raises(PublicError) as caught:
        media.render_media_clip(
            tmp_path / "source.mp4", destination, source_in=2, duration=4, properties={"speed": 2}
        )
    assert caught.value.code == code
    assert not destination.exists()


def test_clip_render_preserves_default_speed(tmp_path, monkeypatch):
    monkeypatch.setattr(media, "find_ffmpeg", lambda: tmp_path / "ffmpeg")
    commands = []
    monkeypatch.setattr(media.subprocess, "run", lambda command, **kwargs: commands.append(command))
    media.render_media_clip(
        tmp_path / "source.mp4", tmp_path / "output.mp4", source_in=0, duration=1, properties={}
    )
    assert "-itsscale" not in commands[0]
    assert commands[0][-1] == str(tmp_path / "output.mp4")


def test_empty_timeline_is_rejected_before_rendering(tmp_path):
    with pytest.raises(PublicError) as caught:
        media.render_timeline([], tmp_path / "output.mp4")
    assert caught.value.code == "EMPTY_TIMELINE"


@pytest.mark.parametrize("fails", [False, True])
def test_timeline_gap_renders_silence_and_cleans_failed_output(tmp_path, monkeypatch, fails):
    monkeypatch.setattr(media, "find_ffmpeg", lambda: tmp_path / "ffmpeg")
    destination = tmp_path / "segments" / "gap.mp4"

    def render(command, **options):
        assert "anullsrc=r=48000:cl=stereo" in command
        assert command[command.index("-t") + 1] == str(1 / 30)
        destination.write_bytes(b"rendered")
        if fails:
            raise subprocess.CalledProcessError(1, command)

    monkeypatch.setattr(media.subprocess, "run", render)
    if fails:
        with pytest.raises(PublicError) as caught:
            media.render_timeline_gap(destination, duration=0)
        assert caught.value.code == "EXPORT_FAILED"
        assert not destination.exists()
    else:
        media.render_timeline_gap(destination, duration=0)
        media.render_timeline_gap(destination, duration=0)
        assert destination.read_bytes() == b"rendered"
    assert (destination.parent / "black.png").is_file()


def test_missing_ffmpeg_has_clear_public_error(tmp_path, monkeypatch):
    monkeypatch.setattr(
        media,
        "get_settings",
        lambda: SimpleNamespace(ffmpeg_path=None, media_root=tmp_path / "a" / "b" / "media"),
    )
    monkeypatch.setattr(media.shutil, "which", lambda name: None)
    with pytest.raises(PublicError) as caught:
        media.find_ffmpeg()
    assert caught.value.code == "FFMPEG_UNAVAILABLE"

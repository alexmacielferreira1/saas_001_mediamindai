# ruff: noqa: F811

from uuid import uuid4

import pytest
from app.api.v1 import media
from app.core.config import get_settings
from app.core.errors import PublicError
from app.media import clip_render
from app.models.identity import TenantRecord
from test_media_api import login
from test_permission_groups_api import permission_client  # noqa: F401


def options(**values):
    return clip_render.parse_render_options({"clip_render": values})


def test_without_clip_render_the_historical_export_is_preserved():
    assert clip_render.parse_render_options({"speed": 2}) is None
    assert (
        clip_render.build_video_filter(None, speed=1, duration=5, subtitles=False)
        == "scale=1280:720"
    )
    assert clip_render.build_audio_filter(None, speed=1, duration=5) is None


@pytest.mark.parametrize(
    "raw",
    [
        "texto",
        {"aspect": "4:3"},
        {"focus_x": 2},
        {"captions": [{"start": 3, "end": 2, "text": "x"}]},
        {"caption_style": {"color": "red"}},
        {"unknown": True},
    ],
)
def test_invalid_render_options_are_rejected(raw):
    with pytest.raises(PublicError) as caught:
        clip_render.parse_render_options({"clip_render": raw})
    assert caught.value.code == "INVALID_EXPORT_OPTIONS"


def test_vertical_fill_crops_around_focus_and_fit_letterboxes():
    vertical = options(aspect="9:16", fit="fill", focus_x=0.25)
    fill = clip_render.build_video_filter(vertical, speed=1, duration=5, subtitles=False)
    assert fill.startswith("crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9):(iw-ow)*0.25:(ih-oh)/2")
    assert "scale=1080:1920" in fill
    square = clip_render.build_video_filter(
        options(aspect="1:1", fit="fit"), speed=1, duration=5, subtitles=True
    )
    assert "force_original_aspect_ratio=decrease" in square
    assert square.endswith("subtitles=captions.ass")


def test_skip_ranges_are_merged_clamped_and_cut_from_video_and_audio():
    value = options(
        skip=[{"start": 1, "end": 2}, {"start": 1.5, "end": 3}, {"start": 9, "end": 20}]
    )
    video = clip_render.build_video_filter(value, speed=1, duration=10, subtitles=False)
    audio = clip_render.build_audio_filter(value, speed=1, duration=10)
    assert "select=not(between(t\\,1\\,3)+between(t\\,9\\,10))" in video
    assert video.endswith("setpts=N/FRAME_RATE/TB")
    assert audio == "aselect=not(between(t\\,1\\,3)+between(t\\,9\\,10)),asetpts=N/SR/TB"
    with pytest.raises(PublicError) as caught:
        clip_render.build_video_filter(
            options(skip=[{"start": 0, "end": 5}]), speed=1, duration=5, subtitles=False
        )
    assert caught.value.code == "EXPORT_EMPTY"


def test_ass_escapes_user_text_wraps_lines_and_positions_cues():
    value = options(
        aspect="9:16",
        captions=[
            {"start": 0, "end": 2, "text": "{\\b1}injeção de tag aqui", "position": "top"},
            {"start": 2, "end": 4, "text": "linha um\nlinha dois"},
        ],
        titles=[{"start": 0, "end": 3, "text": "Gancho"}],
        caption_style={"max_chars": 10, "uppercase": True},
    )
    ass = clip_render.build_ass(value, speed=1, duration=10)
    assert "PlayResX: 1080" in ass and "PlayResY: 1920" in ass
    assert "{\\b1}" not in ass
    assert "｛＼B1｝INJEÇÃO" in ass
    assert "Dialogue: 0,0:00:00.00,0:00:02.00,Caption,,0,0,0,,{\\an8}" in ass
    assert "LINHA UM\\NLINHA DOIS" in ass
    assert "Dialogue: 0,0:00:00.00,0:00:03.00,Title,,0,0,0,,Gancho" in ass


def test_karaoke_highlights_each_timed_word_and_keywords():
    value = options(
        captions=[
            {
                "start": 0,
                "end": 2,
                "text": "Olá mundo",
                "words": [
                    {"start": 0.2, "end": 0.8, "text": "Olá"},
                    {"start": 1.0, "end": 1.8, "text": "mundo"},
                ],
            }
        ],
        caption_style={"karaoke": True, "highlight_color": "#FF0000", "keywords": ["Mundo"]},
    )
    events = [line for line in clip_render.build_ass(value, speed=2, duration=10).splitlines()]
    dialogues = [line for line in events if line.startswith("Dialogue")]
    # Lead-in + one event per word; times are divided by playback speed.
    assert len(dialogues) == 3
    assert dialogues[1].startswith("Dialogue: 0,0:00:00.10,0:00:00.50")
    assert "{\\c&H000000FF}Olá{\\c&H00FFFFFF}" in dialogues[1]
    # Keyword stays emphasised even when it is not the active word.
    assert "{\\c&H000000FF}mundo" in dialogues[0]


def test_render_writes_and_removes_the_subtitle_file(tmp_path, monkeypatch):
    monkeypatch.setattr(media, "find_ffmpeg", lambda: tmp_path / "ffmpeg")
    calls = []

    def run(command, **kwargs):
        calls.append((command, kwargs))
        assert (tmp_path / "out" / "captions.ass").is_file()

    monkeypatch.setattr(media.subprocess, "run", run)
    destination = tmp_path / "out" / "clip.mp4"
    media.render_media_clip(
        tmp_path / "source.mp4",
        destination,
        source_in=1,
        duration=4,
        properties={
            "clip_render": {
                "aspect": "9:16",
                "captions": [{"start": 0, "end": 1, "text": "Oi"}],
                "skip": [{"start": 2, "end": 3}],
            }
        },
    )
    command, kwargs = calls[0]
    assert kwargs["cwd"] == str(tmp_path / "out")
    assert command[command.index("-vf") + 1].count("subtitles=captions.ass") == 1
    assert "-af" in command
    assert not (tmp_path / "out" / "captions.ass").exists()


def test_invalid_options_fail_before_rendering(tmp_path, monkeypatch):
    monkeypatch.setattr(media, "find_ffmpeg", lambda: tmp_path / "ffmpeg")
    monkeypatch.setattr(media.subprocess, "run", lambda *a, **k: pytest.fail("FFmpeg must not run"))
    with pytest.raises(PublicError):
        media.render_media_clip(
            tmp_path / "source.mp4",
            tmp_path / "out" / "clip.mp4",
            source_in=0,
            duration=1,
            properties={"clip_render": {"aspect": "2:1"}},
        )
    assert not (tmp_path / "out").exists()


def test_clip_render_export_validates_options_and_isolates_tenants(
    permission_client, monkeypatch, tmp_path
):
    client, ids = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()
    rendered = []

    def fake_render(source, destination, **kwargs):
        clip_render.parse_render_options(kwargs["properties"])
        rendered.append(kwargs)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"vertical")

    monkeypatch.setattr("app.api.v1.media.render_media_clip", fake_render)
    own = client.post(
        "/api/v1/media/assets", files={"file": ("source.mp4", b"video", "video/mp4")}
    ).json()
    foreign = TenantRecord(
        id=uuid4(),
        tenant_id=ids["other"],
        entity_type="Asset",
        data={"filename": "foreign.mp4", "asset_type": "video", "storage_key": "missing"},
    )
    with ids["session_factory"]() as session:
        session.add(foreign)
        session.commit()
    body = {"duration": 3, "properties": {"clip_render": {"aspect": "9:16"}}}

    ok = client.post("/api/v1/media/exports/clip", json={"asset_id": own["id"], **body})
    cross = client.post("/api/v1/media/exports/clip", json={"asset_id": str(foreign.id), **body})

    assert ok.status_code == 200 and ok.content == b"vertical"
    assert cross.status_code == 404
    assert len(rendered) == 1
    get_settings.cache_clear()


def test_clip_render_export_rejects_invalid_options_before_ffmpeg(
    permission_client, monkeypatch, tmp_path
):
    client, _ = permission_client
    login(client)
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path))
    get_settings.cache_clear()
    own = client.post(
        "/api/v1/media/assets", files={"file": ("source.mp4", b"video", "video/mp4")}
    ).json()
    monkeypatch.setattr(media, "find_ffmpeg", lambda: pytest.fail("FFmpeg must not run"))
    response = client.post(
        "/api/v1/media/exports/clip",
        json={
            "asset_id": own["id"],
            "duration": 3,
            "properties": {"clip_render": {"captions": [{"start": 2, "end": 1, "text": "x"}]}},
        },
    )
    assert response.status_code == 422
    assert response.json()["error_code"] == "INVALID_EXPORT_OPTIONS"
    assert not list(tmp_path.rglob("exports"))
    get_settings.cache_clear()

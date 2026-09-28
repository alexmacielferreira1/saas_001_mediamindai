from pathlib import Path

from app.api.v1 import media
from app.api.v1.media import build_timeline_render_plan, trim_clip_to_export_range


def test_export_range_keeps_clip_position_relative_to_sequence_in():
    trimmed = trim_clip_to_export_range(
        {"start": 4, "sourceIn": 2, "duration": 3, "properties": {"speed": 1}},
        in_point=1,
        out_point=10,
    )

    assert trimmed["timeline_start"] == 3


def test_render_plan_preserves_leading_and_internal_timeline_gaps():
    """Removing gap generation would collapse the exported sequence in time."""
    first = {
        "source": Path("first.mp4"),
        "source_in": 0,
        "duration": 1,
        "timeline_start": 2,
        "properties": {"speed": 1},
    }
    second = {
        "source": Path("second.mp4"),
        "source_in": 0,
        "duration": 1,
        "timeline_start": 5,
        "properties": {"speed": 1},
    }

    plan = build_timeline_render_plan([second, first])

    assert [(item["kind"], item["duration"]) for item in plan] == [
        ("gap", 2),
        ("media", 1),
        ("gap", 2),
        ("media", 1),
    ]
    assert plan[1]["source"] == Path("first.mp4")
    assert plan[3]["source"] == Path("second.mp4")


def test_timeline_renderer_materializes_black_silent_gap_files(monkeypatch, tmp_path):
    rendered_order = []

    def fake_media(source, destination, **_options):
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"media")
        rendered_order.append(("media", source.name))

    def fake_gap(destination, *, duration):
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"gap")
        rendered_order.append(("gap", duration))

    monkeypatch.setattr(media, "render_media_clip", fake_media)
    monkeypatch.setattr(media, "render_timeline_gap", fake_gap)
    monkeypatch.setattr(media, "find_ffmpeg", lambda: Path("ffmpeg"))
    monkeypatch.setattr(media.subprocess, "run", lambda *_args, **_kwargs: None)

    media.render_timeline(
        [
            {
                "source": Path("story.mp4"),
                "source_in": 0,
                "duration": 1,
                "timeline_start": 2,
                "properties": {"speed": 1},
            }
        ],
        tmp_path / "timeline.mp4",
    )

    assert rendered_order == [("gap", 2), ("media", "story.mp4")]

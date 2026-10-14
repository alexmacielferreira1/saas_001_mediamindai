import json
from pathlib import Path

import pytest

from app.clips.transcription import CommandTranscriptionAdapter, TranscriptionUnavailable


def test_command_adapter_converts_timestamped_provider_json_to_segments(monkeypatch, tmp_path):
    source = tmp_path / "entrevista.mp4"
    source.write_bytes(b"video")
    def fake_run(command, **_kwargs):
        output = Path(command[command.index("--output") + 1])
        output.write_text(
            json.dumps(
                {"segments": [{"start": 1, "end": 3, "text": "fala real", "words": [{"text": "fala", "start": 1, "end": 1.4}, {"text": "real", "start": 1.4, "end": 1.8}]}]},
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    monkeypatch.setattr("app.clips.transcription.subprocess.run", fake_run)
    adapter = CommandTranscriptionAdapter("transcriber --input {input} --output {output}")

    segments = adapter.transcribe(source)

    assert segments[0].text == "fala real"
    assert segments[0].words[1].end == 1.8


def test_adapter_without_a_configured_command_is_explicitly_unavailable(tmp_path):
    with pytest.raises(TranscriptionUnavailable):
        CommandTranscriptionAdapter.from_environment().transcribe(tmp_path / "source.mp4")

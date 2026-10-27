import json
from pathlib import Path

import pytest
from app.clips.transcription import (
    CommandTranscriptionAdapter,
    RemoteTranscriptionAdapter,
    TranscriptionUnavailable,
)


def test_command_adapter_converts_timestamped_provider_json_to_segments(monkeypatch, tmp_path):
    source = tmp_path / "entrevista.mp4"
    source.write_bytes(b"video")
    seen = []

    def fake_run(command, **_kwargs):
        seen.extend(command)
        output = Path(command[command.index("--output") + 1])
        output.write_text(
            json.dumps(
                {
                    "segments": [
                        {
                            "start": 1,
                            "end": 3,
                            "text": "fala real",
                            "words": [
                                {"text": "fala", "start": 1, "end": 1.4},
                                {"text": "real", "start": 1.4, "end": 1.8},
                            ],
                        }
                    ]
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    monkeypatch.setattr("app.clips.transcription.subprocess.run", fake_run)
    adapter = CommandTranscriptionAdapter("transcriber --input {input} --output {output}")

    segments = adapter.transcribe(source)

    assert segments[0].text == "fala real"
    assert segments[0].words[1].end == 1.8
    assert str(source) in seen


def test_adapter_without_a_configured_command_is_explicitly_unavailable(tmp_path, monkeypatch):
    # Máquina sem o faster-whisper (ex.: Render): sem comando e sem o Whisper local.
    monkeypatch.setattr("app.clips.transcription.local_whisper_command", lambda: None)
    with pytest.raises(TranscriptionUnavailable):
        CommandTranscriptionAdapter.from_environment().transcribe(tmp_path / "source.mp4")


def test_remote_adapter_uses_selected_compatible_provider_and_returns_timestamps(
    monkeypatch, tmp_path
):
    source = tmp_path / "entrevista.mp4"
    source.write_bytes(b"video")
    captured = {}

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "segments": [{"start": 0, "end": 24, "text": "Uma fala realmente importante."}],
                "words": [
                    {"word": "Uma", "start": 0.1, "end": 0.4},
                    {"word": "fala", "start": 0.4, "end": 0.8},
                    {"word": "realmente", "start": 0.8, "end": 1.4},
                    {"word": "importante.", "start": 1.4, "end": 2.1},
                ],
            }

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return Response()

    monkeypatch.setattr("app.clips.transcription.httpx.post", fake_post)

    segments = RemoteTranscriptionAdapter(
        {"provider": "compatible", "base_url": "https://api.example.test/v1", "model": "gpt-4o"},
        "secret-key",
    ).transcribe(source)

    assert captured["url"] == "https://api.example.test/v1/audio/transcriptions"
    assert captured["headers"]["Authorization"] == "Bearer secret-key"
    assert captured["data"]["model"] == "whisper-1"
    assert segments[0].words[2].text == "realmente"

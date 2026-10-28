"""scripts/transcribe_local.py: grava o formato esperado pelo CommandTranscriptionAdapter."""

import importlib.util
import json
import sys
import types
from pathlib import Path

from app.clips.transcription import CommandTranscriptionAdapter

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "transcribe_local.py"


def _load(monkeypatch, segments):
    word = types.SimpleNamespace
    fake = types.ModuleType("faster_whisper")

    class WhisperModel:
        def __init__(self, *_args, **_kwargs):
            pass

        def transcribe(self, *_args, **_kwargs):
            return iter(segments(word)), None

    fake.WhisperModel = WhisperModel
    monkeypatch.setitem(sys.modules, "faster_whisper", fake)
    spec = importlib.util.spec_from_file_location("transcribe_local", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_script_output_is_readable_by_the_local_adapter(tmp_path, monkeypatch):
    def segments(w):
        return [
            w(
                start=0.0,
                end=2.0,
                text=" Olá mundo",
                words=[w(word=" Olá", start=0.1, end=0.5), w(word=" mundo", start=0.6, end=1.0)],
            ),
            w(start=2.0, end=3.0, text=" ", words=[]),
        ]

    module = _load(monkeypatch, segments)
    source = tmp_path / "video.mp4"
    source.write_bytes(b"video")
    output = tmp_path / "out.json"

    assert module.main(str(source), str(output)) == 0
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["segments"][0]["text"] == "Olá mundo"
    assert [w["text"] for w in payload["segments"][0]["words"]] == ["Olá", "mundo"]
    assert len(payload["segments"]) == 1

    def run(command, **_kwargs):
        module.main(command[-2], command[-1])

    monkeypatch.setattr("app.clips.transcription.subprocess.run", run)
    result = CommandTranscriptionAdapter("transcrever {input} {output}").transcribe(source)
    assert result[0].words[1].text == "mundo"


def test_zero_length_word_from_whisper_does_not_discard_the_transcript(tmp_path, monkeypatch):
    # Caso real (reportagem com valor em reais): o Whisper marcou "$" com início == fim.
    def segments(w):
        return [
            w(
                start=33.0,
                end=35.0,
                text=" dois milhões de $ reais",
                words=[w(word=" dois", start=33.5, end=33.9), w(word="$", start=33.98, end=33.98)],
            )
        ]

    module = _load(monkeypatch, segments)
    source = tmp_path / "video.mp4"
    source.write_bytes(b"video")

    def run(command, **_kwargs):
        module.main(command[-2], command[-1])

    monkeypatch.setattr("app.clips.transcription.subprocess.run", run)
    result = CommandTranscriptionAdapter("transcrever {input} {output}").transcribe(source)
    assert result[0].words[1].start == 33.98
    assert result[0].words[1].end > result[0].words[1].start


def test_script_fails_instead_of_inventing_text_without_speech(tmp_path, monkeypatch):
    module = _load(monkeypatch, lambda _w: [])
    output = tmp_path / "out.json"

    assert module.main(str(tmp_path / "video.mp4"), str(output)) == 1
    assert not output.exists()

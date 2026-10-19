import subprocess

import httpx
import pytest
from app.clips.analysis import CommandAnalysisAdapter, RemoteAnalysisAdapter
from app.clips.contracts import TranscriptSegment, TranscriptWord
from app.clips.transcription import (
    CommandTranscriptionAdapter,
    RemoteTranscriptionAdapter,
    TranscriptionUnavailable,
)


@pytest.fixture
def source(tmp_path):
    path = tmp_path / "source.mp4"
    path.write_bytes(b"test media")
    return path


@pytest.fixture
def transcript():
    return [
        TranscriptSegment(
            start=0,
            end=25,
            text="Texto original",
            words=[TranscriptWord(text="Texto", start=1, end=2)],
        )
    ]


def test_local_transcriber_rejects_missing_media(source):
    with pytest.raises(FileNotFoundError, match="mídia"):
        CommandTranscriptionAdapter("transcriber {input} {output}").transcribe(
            source.with_name("missing.mp4")
        )


@pytest.mark.parametrize(
    "failure",
    [
        OSError("offline"),
        subprocess.CalledProcessError(1, "transcriber"),
        subprocess.TimeoutExpired("transcriber", 1),
    ],
)
def test_local_transcriber_reports_command_failure_without_fabricating_text(
    source, monkeypatch, failure
):
    def fail(*_args, **_kwargs):
        raise failure

    monkeypatch.setattr("app.clips.transcription.subprocess.run", fail)
    with pytest.raises(TranscriptionUnavailable, match="não conseguiu processar"):
        CommandTranscriptionAdapter("transcriber {input} {output}").transcribe(source)


def test_local_transcriber_requires_output_file(source, monkeypatch):
    monkeypatch.setattr("app.clips.transcription.subprocess.run", lambda *_a, **_k: None)
    with pytest.raises(TranscriptionUnavailable, match="não retornou"):
        CommandTranscriptionAdapter("transcriber {input} {output}").transcribe(source)


@pytest.mark.parametrize("content", ["{", '{"segments": [{"start": 0}]}'])
def test_local_transcriber_rejects_malformed_output(source, monkeypatch, content):
    def write_output(command, **_kwargs):
        from pathlib import Path

        Path(command[-1]).write_text(content, encoding="utf-8")

    monkeypatch.setattr("app.clips.transcription.subprocess.run", write_output)
    with pytest.raises(TranscriptionUnavailable, match="marcações de tempo inválidas"):
        CommandTranscriptionAdapter("transcriber {input} {output}").transcribe(source)


def test_remote_transcriber_rejects_unsupported_provider(source):
    with pytest.raises(TranscriptionUnavailable, match="não oferece transcrição"):
        RemoteTranscriptionAdapter({"provider": "unsupported"}, "secret").transcribe(source)


def test_remote_transcriber_rejects_missing_media(source):
    with pytest.raises(FileNotFoundError, match="mídia"):
        RemoteTranscriptionAdapter({"provider": "compatible"}, "secret").transcribe(
            source.with_name("missing.mp4")
        )


def test_remote_transcriber_reports_connection_failure(source, monkeypatch):
    def fail(*_args, **_kwargs):
        raise httpx.ConnectError("private connection details")

    monkeypatch.setattr("app.clips.transcription.httpx.post", fail)
    with pytest.raises(TranscriptionUnavailable, match="não conseguiu transcrever") as error:
        RemoteTranscriptionAdapter(
            {"provider": "compatible", "base_url": "https://example.test"}, "secret"
        ).transcribe(source)
    assert "secret" not in str(error.value)
    assert "private connection details" not in str(error.value)


def test_remote_transcriber_requires_timestamped_segments():
    with pytest.raises(ValueError, match="segmentos temporizados"):
        RemoteTranscriptionAdapter._segments({"text": "texto sem tempos"})


def test_remote_transcriber_keeps_segment_text_when_no_word_timestamps_exist():
    segments = RemoteTranscriptionAdapter._segments(
        {"segments": [{"start": 1, "end": 3, "text": "Fala original"}]}
    )
    assert segments[0].words[0].text == "Fala original"
    assert segments[0].words[0].start == 1
    assert segments[0].words[0].end == 3


def test_local_analyzer_requires_configured_command(transcript):
    with pytest.raises(TranscriptionUnavailable, match="Nenhum analisador"):
        CommandAnalysisAdapter(None).suggest(transcript)


@pytest.mark.parametrize("failure", [OSError("offline"), subprocess.TimeoutExpired("analyzer", 1)])
def test_local_analyzer_reports_command_failure(transcript, monkeypatch, failure):
    def fail(*_args, **_kwargs):
        raise failure

    monkeypatch.setattr("app.clips.analysis.subprocess.run", fail)
    with pytest.raises(TranscriptionUnavailable, match="não conseguiu avaliar"):
        CommandAnalysisAdapter("analyzer {input} {output}").suggest(transcript)


def test_local_analyzer_requires_output_file(transcript, monkeypatch):
    monkeypatch.setattr("app.clips.analysis.subprocess.run", lambda *_a, **_k: None)
    with pytest.raises(TranscriptionUnavailable, match="não retornou candidatos"):
        CommandAnalysisAdapter("analyzer {input} {output}").suggest(transcript)


def test_local_analyzer_rejects_malformed_candidates(transcript, monkeypatch):
    def write_invalid(command, **_kwargs):
        from pathlib import Path

        Path(command[-1]).write_text('{"candidates": [{}]}', encoding="utf-8")

    monkeypatch.setattr("app.clips.analysis.subprocess.run", write_invalid)
    with pytest.raises(TranscriptionUnavailable, match="candidatos inválidos"):
        CommandAnalysisAdapter("analyzer {input} {output}").suggest(transcript)


def test_remote_analyzer_rejects_unsupported_provider(transcript):
    with pytest.raises(TranscriptionUnavailable, match="não oferece análise"):
        RemoteAnalysisAdapter({"provider": "unsupported"}, "secret").suggest(transcript)


def test_remote_analyzer_reports_connection_failure_without_secrets(transcript, monkeypatch):
    def fail(*_args, **_kwargs):
        raise httpx.ConnectError("private connection details")

    monkeypatch.setattr("app.clips.analysis.httpx.post", fail)
    with pytest.raises(TranscriptionUnavailable, match="não conseguiu propor") as error:
        RemoteAnalysisAdapter(
            {"provider": "compatible", "base_url": "https://example.test", "model": "m"},
            "secret",
        ).suggest(transcript)
    assert "secret" not in str(error.value)
    assert "private connection details" not in str(error.value)


def test_remote_analyzer_rejects_cuts_without_transcript_evidence(transcript, monkeypatch):
    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": '{"candidates": [{}]}'}}]}

    monkeypatch.setattr("app.clips.analysis.httpx.post", lambda *_a, **_k: Response())
    with pytest.raises(TranscriptionUnavailable, match="sem evidências utilizáveis"):
        RemoteAnalysisAdapter(
            {"provider": "compatible", "base_url": "https://example.test", "model": "m"},
            "secret",
        ).suggest(transcript)

import pytest
from app.clips.analysis import CommandAnalysisAdapter
from app.clips.captions import captions_for_candidate
from app.clips.contracts import CandidateDimensions, TranscriptWord
from app.clips.scoring import build_candidate
from app.clips.transcription import RemoteTranscriptionAdapter
from pydantic import ValidationError

DIMENSIONS = CandidateDimensions(hook=20, flow=20, value=20, shareability=20)


def _words():
    return [
        TranscriptWord(text="Fala", start=1, end=1.2),
        TranscriptWord(text="real", start=1.2, end=1.5),
    ]


def test_transcript_word_must_end_after_it_starts():
    with pytest.raises(ValidationError):
        TranscriptWord(text="eco", start=2, end=2)


def test_captions_reject_non_positive_word_groups():
    candidate = build_candidate(start=0, end=20, evidence=_words(), dimensions=DIMENSIONS)

    with pytest.raises(ValueError):
        captions_for_candidate(candidate, max_words=0)


@pytest.mark.parametrize(
    ("start", "end"),
    [(0, 10), (0, 61)],
)
def test_candidate_duration_must_stay_between_15_and_60_seconds(start, end):
    with pytest.raises(ValueError):
        build_candidate(start=start, end=end, evidence=_words(), dimensions=DIMENSIONS)


def test_candidate_evidence_must_be_inside_the_selected_interval():
    with pytest.raises(ValueError, match="dentro do trecho"):
        build_candidate(start=5, end=25, evidence=_words(), dimensions=DIMENSIONS)


def test_analysis_adapter_reads_command_from_environment(monkeypatch):
    monkeypatch.setenv("CLIPS_ANALYSIS_COMMAND", "  analisar {input}  ")

    assert CommandAnalysisAdapter.from_environment().command_template == "analisar {input}"


def test_remote_transcript_skips_segments_without_words_or_text():
    segments = RemoteTranscriptionAdapter._segments(
        {
            "words": [{"word": "Oi", "start": 0.1, "end": 0.4}],
            "segments": [
                {"start": 0, "end": 1, "text": "Oi"},
                {"start": 5, "end": 6, "text": "   "},
                {"start": 7, "end": 8, "text": "Sem palavras"},
            ],
        }
    )

    assert [segment.text for segment in segments] == ["Oi", "Sem palavras"]
    assert segments[1].words[0].text == "Sem palavras"

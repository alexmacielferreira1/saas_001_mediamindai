import pytest

from app.clips.contracts import CandidateDimensions, TranscriptWord
from app.clips.scoring import build_candidate, normalize_transcript


def dimensions() -> CandidateDimensions:
    return CandidateDimensions(hook=22, flow=21, value=20, shareability=19)


def words() -> list[TranscriptWord]:
    return [
        TranscriptWord(text="Uma", start=10.0, end=10.2),
        TranscriptWord(text="ideia", start=10.2, end=10.6),
        TranscriptWord(text="importante", start=10.6, end=11.2),
    ]


def test_build_candidate_rejects_range_without_evidence_or_outside_allowed_duration():
    with pytest.raises(ValueError, match="evidência"):
        build_candidate(start=0, end=31, evidence=[], dimensions=dimensions())

    with pytest.raises(ValueError, match="60"):
        build_candidate(start=0, end=61, evidence=words(), dimensions=dimensions())


def test_build_candidate_keeps_real_quote_and_composes_deterministic_score():
    candidate = build_candidate(start=10, end=35, evidence=words(), dimensions=dimensions())

    assert candidate.quote == "Uma ideia importante"
    assert candidate.score == 82
    assert candidate.start == 10
    assert candidate.end == 35


def test_normalize_transcript_rejects_overlapping_or_non_monotonic_words():
    with pytest.raises(ValueError, match="sobreposição"):
        normalize_transcript(
            [TranscriptWord(text="um", start=1, end=2), TranscriptWord(text="dois", start=1.5, end=3)]
        )

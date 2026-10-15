from app.clips.captions import captions_for_candidate
from app.clips.contracts import CandidateDimensions, TranscriptWord
from app.clips.scoring import build_candidate


def test_captions_are_grouped_only_from_candidate_evidence():
    words = [
        TranscriptWord(text="Uma", start=0, end=0.3),
        TranscriptWord(text="fala", start=0.3, end=0.6),
        TranscriptWord(text="real", start=0.6, end=0.9),
        TranscriptWord(text="para", start=0.9, end=1.2),
        TranscriptWord(text="legendar", start=1.2, end=1.7),
        TranscriptWord(text="agora.", start=1.7, end=2.1),
    ]
    candidate = build_candidate(
        start=0,
        end=20,
        evidence=words,
        dimensions=CandidateDimensions(hook=20, flow=20, value=20, shareability=20),
    )

    captions = captions_for_candidate(candidate, max_words=3)

    assert [cue.text for cue in captions] == ["Uma fala real", "para legendar agora."]
    assert captions[0].start == 0
    assert captions[-1].end == 2.1

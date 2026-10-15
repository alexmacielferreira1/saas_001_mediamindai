from app.clips.contracts import CaptionCue, ClipCandidate


def captions_for_candidate(candidate: ClipCandidate, *, max_words: int = 5) -> list[CaptionCue]:
    """Create editable timed captions from the selected candidate's evidence.

    The content and timing are copied from the real transcript; no language
    model completes or rewrites a phrase at this stage.
    """
    if max_words < 1:
        raise ValueError("max_words must be positive")
    cues = []
    for index in range(0, len(candidate.evidence), max_words):
        group = candidate.evidence[index : index + max_words]
        cues.append(
            CaptionCue(
                start=group[0].start,
                end=group[-1].end,
                text=" ".join(word.text for word in group),
            )
        )
    return cues

from app.clips.contracts import CandidateDimensions, ClipCandidate, TranscriptWord

MIN_CANDIDATE_SECONDS = 15.0
MAX_CANDIDATE_SECONDS = 60.0


def normalize_transcript(words: list[TranscriptWord]) -> list[TranscriptWord]:
    """Validate that a provider result can safely support time-coded editing."""
    previous_end = -1.0
    normalized: list[TranscriptWord] = []
    for word in words:
        if word.start < previous_end:
            raise ValueError("A transcrição contém sobreposição ou ordem inválida.")
        normalized.append(word)
        previous_end = word.end
    return normalized


def build_candidate(
    *,
    start: float,
    end: float,
    evidence: list[TranscriptWord],
    dimensions: CandidateDimensions,
) -> ClipCandidate:
    duration = end - start
    if duration < MIN_CANDIDATE_SECONDS:
        raise ValueError("O trecho precisa ter pelo menos 15 segundos.")
    if duration > MAX_CANDIDATE_SECONDS:
        raise ValueError("O trecho não pode ultrapassar 60 segundos.")
    if not evidence:
        raise ValueError("O trecho precisa de evidência da transcrição.")
    normalized = normalize_transcript(evidence)
    if normalized[0].start < start or normalized[-1].end > end:
        raise ValueError("A evidência precisa estar dentro do trecho selecionado.")
    return ClipCandidate(
        start=start,
        end=end,
        quote=" ".join(word.text.strip() for word in normalized).strip(),
        score=dimensions.total,
        dimensions=dimensions,
        evidence=normalized,
    )

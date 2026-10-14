import json
import os
import shlex
import subprocess
import tempfile
from pathlib import Path

from app.clips.contracts import CandidateDimensions, ClipCandidate, TranscriptSegment, TranscriptWord
from app.clips.scoring import build_candidate
from app.clips.transcription import TranscriptionUnavailable


class CommandAnalysisAdapter:
    """Run an organization-selected analysis command against timestamped transcript JSON."""

    def __init__(self, command_template: str | None):
        self.command_template = (command_template or "").strip()

    @classmethod
    def from_environment(cls) -> "CommandAnalysisAdapter":
        return cls(os.getenv("CLIPS_ANALYSIS_COMMAND"))

    def suggest(self, segments: list[TranscriptSegment]) -> list[ClipCandidate]:
        if not self.command_template:
            raise TranscriptionUnavailable("Nenhum analisador de trechos foi configurado.")
        words = [word for segment in segments for word in segment.words]
        with tempfile.TemporaryDirectory(prefix="mediamind-clips-analysis-") as temporary:
            root = Path(temporary)
            source = root / "transcript.json"
            destination = root / "candidates.json"
            source.write_text(
                json.dumps({"segments": [segment.model_dump(mode="json") for segment in segments]}, ensure_ascii=False),
                encoding="utf-8",
            )
            command = [
                part.format(input=str(source), output=str(destination))
                for part in shlex.split(self.command_template)
            ]
            try:
                subprocess.run(command, check=True, capture_output=True, timeout=15 * 60)
            except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
                raise TranscriptionUnavailable("O analisador não conseguiu avaliar a transcrição.") from error
            if not destination.is_file():
                raise TranscriptionUnavailable("O analisador não retornou candidatos utilizáveis.")
            try:
                proposals = json.loads(destination.read_text(encoding="utf-8"))["candidates"]
                return [self._candidate(proposal, words) for proposal in proposals]
            except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
                raise TranscriptionUnavailable("O analisador retornou candidatos inválidos.") from error

    @staticmethod
    def _candidate(proposal: dict, words: list[TranscriptWord]) -> ClipCandidate:
        start = float(proposal["start"])
        end = float(proposal["end"])
        evidence = [word for word in words if word.start >= start and word.end <= end]
        return build_candidate(
            start=start,
            end=end,
            evidence=evidence,
            dimensions=CandidateDimensions(
                hook=int(proposal["hook"]),
                flow=int(proposal["flow"]),
                value=int(proposal["value"]),
                shareability=int(proposal["shareability"]),
            ),
        )

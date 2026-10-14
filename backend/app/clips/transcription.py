import json
import os
import shlex
import subprocess
import tempfile
from pathlib import Path

from app.clips.contracts import TranscriptSegment, TranscriptWord


class TranscriptionUnavailable(RuntimeError):
    """Raised when this installation has no real speech-to-text provider."""


class CommandTranscriptionAdapter:
    """Adapter for a local or managed transcriber that writes timestamped JSON.

    The configured command receives `{input}` and `{output}` placeholders.
    It must write `{ "segments": [{start, end, text, words: [...] }] }` and
    never returns a fabricated fallback transcript.
    """

    def __init__(self, command_template: str | None):
        self.command_template = (command_template or "").strip()

    @classmethod
    def from_environment(cls) -> "CommandTranscriptionAdapter":
        return cls(os.getenv("CLIPS_TRANSCRIBER_COMMAND"))

    def transcribe(self, source: Path) -> list[TranscriptSegment]:
        if not self.command_template:
            raise TranscriptionUnavailable("Nenhum transcritor foi configurado.")
        if not source.is_file():
            raise FileNotFoundError("Arquivo de mídia não encontrado.")
        with tempfile.TemporaryDirectory(prefix="mediamind-clips-") as temporary:
            output = Path(temporary) / "transcript.json"
            command = [
                part.format(input=str(source), output=str(output))
                for part in shlex.split(self.command_template)
            ]
            try:
                subprocess.run(command, check=True, capture_output=True, timeout=60 * 60)
            except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
                raise TranscriptionUnavailable("O transcritor não conseguiu processar a mídia.") from error
            if not output.is_file():
                raise TranscriptionUnavailable("O transcritor não retornou uma transcrição utilizável.")
            try:
                payload = json.loads(output.read_text(encoding="utf-8"))
                return [
                    TranscriptSegment(
                        start=item["start"],
                        end=item["end"],
                        text=item["text"],
                        words=[TranscriptWord(**word) for word in item["words"]],
                    )
                    for item in payload["segments"]
                ]
            except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
                raise TranscriptionUnavailable("O transcritor retornou marcações de tempo inválidas.") from error

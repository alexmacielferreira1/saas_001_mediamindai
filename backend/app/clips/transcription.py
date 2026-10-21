import json
import os
import shlex
import subprocess
import tempfile
from pathlib import Path

import httpx

from app.clips.contracts import TranscriptSegment, TranscriptWord
from app.security.outbound import OutboundUrlRejected, validate_outbound_url


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
                raise TranscriptionUnavailable(
                    "O transcritor não conseguiu processar a mídia."
                ) from error
            if not output.is_file():
                raise TranscriptionUnavailable(
                    "O transcritor não retornou uma transcrição utilizável."
                )
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
                raise TranscriptionUnavailable(
                    "O transcritor retornou marcações de tempo inválidas."
                ) from error


class RemoteTranscriptionAdapter:
    """Use the selected OpenAI-compatible connection for a real transcript.

    The response must include time-coded segments.  There is intentionally no
    text fallback: captions and cut candidates cannot be honestly generated
    without temporal evidence.
    """

    def __init__(self, connection: dict, api_key: str):
        self.connection = connection
        self.api_key = api_key

    def transcribe(self, source: Path) -> list[TranscriptSegment]:
        if self.connection.get("provider") != "compatible":
            raise TranscriptionUnavailable(
                "A IA escolhida não oferece transcrição de mídia neste formato."
            )
        if not source.is_file():
            raise FileNotFoundError("Arquivo de mídia não encontrado.")
        endpoint = f"{str(self.connection['base_url']).rstrip('/')}/audio/transcriptions"
        try:
            validate_outbound_url(endpoint)
        except OutboundUrlRejected as error:
            raise TranscriptionUnavailable(
                "O endereço configurado para a IA não é permitido pelo servidor."
            ) from error
        try:
            with source.open("rb") as media:
                response = httpx.post(
                    endpoint,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    data={
                        "model": self.connection.get("transcription_model", "whisper-1"),
                        "response_format": "verbose_json",
                        "timestamp_granularities[]": "word",
                    },
                    files={"file": (source.name, media, "application/octet-stream")},
                    timeout=60 * 15,
                )
            response.raise_for_status()
            return self._segments(response.json())
        except (httpx.HTTPError, OSError, KeyError, TypeError, ValueError) as error:
            raise TranscriptionUnavailable(
                "A IA selecionada não conseguiu transcrever esta mídia."
            ) from error

    @staticmethod
    def _segments(payload: dict) -> list[TranscriptSegment]:
        raw_words = payload.get("words") or []
        words = [
            TranscriptWord(
                text=item.get("word", item.get("text", "")).strip(),
                start=item["start"],
                end=item["end"],
            )
            for item in raw_words
            if item.get("word", item.get("text", "")).strip()
        ]
        raw_segments = payload.get("segments") or []
        segments = []
        for item in raw_segments:
            start = float(item["start"])
            end = float(item["end"])
            segment_words = [word for word in words if word.start >= start and word.end <= end]
            if not segment_words:
                text = str(item.get("text", "")).strip()
                if not text:
                    continue
                segment_words = [TranscriptWord(text=text, start=start, end=end)]
            segments.append(
                TranscriptSegment(
                    start=start,
                    end=end,
                    text=str(
                        item.get("text") or " ".join(word.text for word in segment_words)
                    ).strip(),
                    words=segment_words,
                )
            )
        if not segments:
            raise ValueError("Resposta sem segmentos temporizados.")
        return segments

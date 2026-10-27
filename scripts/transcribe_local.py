"""Transcritor local gratuito para os cortes automáticos (faster-whisper, roda na CPU).

Uso pelo backend, no .env:
    CLIPS_TRANSCRIBER_COMMAND=.venv/Scripts/python scripts/transcribe_local.py {input} {output}
(no Linux/macOS: .venv/bin/python). Use barras normais no caminho.

Instalação única: .venv/Scripts/python -m pip install faster-whisper
Modelo opcional: CLIPS_WHISPER_MODEL (padrão "small"; "base" é mais rápido, "medium" mais preciso).
Escreve {"segments": [{start, end, text, words: [{text, start, end}]}]}, o formato
esperado por CommandTranscriptionAdapter. Nunca inventa texto: falha se não houver fala.
"""

import json
import os
import sys
from pathlib import Path


def main(source: str, destination: str) -> int:
    from faster_whisper import WhisperModel

    model = WhisperModel(
        os.getenv("CLIPS_WHISPER_MODEL", "small"), device="cpu", compute_type="int8"
    )
    raw_segments, _info = model.transcribe(source, word_timestamps=True, vad_filter=True)
    segments = []
    for segment in raw_segments:
        words = [
            {"text": word.word.strip(), "start": float(word.start), "end": float(word.end)}
            for word in segment.words or []
            if word.word.strip()
        ]
        text = segment.text.strip()
        if text and words:
            segments.append(
                {
                    "start": float(segment.start),
                    "end": float(segment.end),
                    "text": text,
                    "words": words,
                }
            )
    if not segments:
        print("Nenhuma fala reconhecida na mídia.", file=sys.stderr)
        return 1
    Path(destination).write_text(
        json.dumps({"segments": segments}, ensure_ascii=False), encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: transcribe_local.py <entrada> <saida.json>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))

import json
from pathlib import Path

from app.clips.analysis import CommandAnalysisAdapter
from app.clips.contracts import TranscriptSegment, TranscriptWord


def test_analysis_adapter_maps_a_provider_proposal_to_real_transcript_evidence(monkeypatch):
    segments = [
        TranscriptSegment(
            start=0,
            end=30,
            text="Esta medida melhora a vida de todos os moradores.",
            words=[
                TranscriptWord(text="Esta", start=1, end=1.2),
                TranscriptWord(text="medida", start=1.2, end=1.6),
                TranscriptWord(text="melhora", start=1.6, end=2),
                TranscriptWord(text="a", start=2, end=2.1),
                TranscriptWord(text="vida", start=2.1, end=2.4),
                TranscriptWord(text="de", start=2.4, end=2.5),
                TranscriptWord(text="todos", start=2.5, end=2.9),
                TranscriptWord(text="os", start=2.9, end=3),
                TranscriptWord(text="moradores.", start=3, end=3.5),
            ],
        )
    ]

    def fake_run(command, **_kwargs):
        output = Path(command[command.index("--output") + 1])
        output.write_text(
            json.dumps({"candidates": [{"start": 0, "end": 25, "hook": 22, "flow": 20, "value": 21, "shareability": 19}]}),
            encoding="utf-8",
        )

    monkeypatch.setattr("app.clips.analysis.subprocess.run", fake_run)

    candidates = CommandAnalysisAdapter("analyzer --input {input} --output {output}").suggest(segments)

    assert candidates[0].quote == "Esta medida melhora a vida de todos os moradores."
    assert candidates[0].score == 82

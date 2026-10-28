"""A análise de cortes reaproveita a transcrição já salva (Ingest/Workspace/MMFilm)."""

# ruff: noqa: F811

from uuid import uuid4

import pytest
from app.media.transcripts import saved_segments
from app.models.identity import TenantRecord
from test_clips_api_error_paths import _candidate, _real_source
from test_media_api import login, permission_client  # noqa: F401


def save_segments(ids, asset_id, rows):
    with ids["session_factory"]() as session:
        for row in rows:
            session.add(
                TenantRecord(
                    id=uuid4(),
                    tenant_id=ids["tenant"],
                    entity_type="TranscricaoSegmento",
                    data={"asset_id": str(asset_id), **row},
                )
            )
        session.commit()


def words(start, end):
    return [{"text": "fala", "start": start, "end": end}]


def run_analysis(client, monkeypatch, asset_id, calls):
    segment, candidate = _candidate()

    class Whisper:
        def transcribe(self, _path):
            calls.append("whisper")
            return [segment]

    class Analysis:
        def suggest(self, segments):
            calls.append(("analysis", [item.text for item in segments]))
            return [candidate]

    monkeypatch.setattr(
        "app.api.v1.clips.CommandTranscriptionAdapter.from_environment", lambda: Whisper()
    )
    monkeypatch.setattr(
        "app.api.v1.clips.CommandAnalysisAdapter.from_environment", lambda: Analysis()
    )
    return client.post("/api/v1/clips/analyses", json={"asset_id": str(asset_id)})


def test_saved_transcript_with_words_is_reused(permission_client, monkeypatch, tmp_path):
    client, ids = permission_client
    login(client)
    asset_id = _real_source(ids, tmp_path, monkeypatch)
    save_segments(
        ids,
        asset_id,
        [
            {"start_ms": 2000, "end_ms": 4000, "texto": "Segunda.", "palavras": words(2, 4)},
            {"start_ms": 0, "end_ms": 2000, "texto": "Primeira.", "palavras": words(0, 2)},
        ],
    )
    calls = []

    response = run_analysis(client, monkeypatch, asset_id, calls)

    assert response.json()["status"] == "completed"
    assert calls == [("analysis", ["Primeira.", "Segunda."])]


@pytest.mark.parametrize(
    "rows",
    [
        [{"start_ms": 0, "end_ms": 2000, "texto": "Digitado sem tempos"}],
        [{"start_ms": 0, "end_ms": 2000, "texto": "Ruim", "palavras": [{"text": "x"}]}],
    ],
)
def test_transcript_without_usable_words_is_transcribed_again(
    permission_client, monkeypatch, tmp_path, rows
):
    client, ids = permission_client
    login(client)
    asset_id = _real_source(ids, tmp_path, monkeypatch)
    save_segments(ids, asset_id, rows)
    calls = []

    run_analysis(client, monkeypatch, asset_id, calls)

    assert calls[0] == "whisper"


def test_saved_segments_of_another_company_are_not_used(permission_client):
    _client, ids = permission_client
    asset_id = uuid4()
    with ids["session_factory"]() as session:
        session.add(
            TenantRecord(
                tenant_id=ids["other"],
                entity_type="TranscricaoSegmento",
                data={
                    "asset_id": str(asset_id),
                    "start_ms": 0,
                    "end_ms": 1000,
                    "texto": "De outra empresa",
                    "palavras": words(0, 1),
                },
            )
        )
        session.commit()
        assert saved_segments(session, ids["tenant"], asset_id) is None
        assert len(saved_segments(session, ids["other"], asset_id)) == 1

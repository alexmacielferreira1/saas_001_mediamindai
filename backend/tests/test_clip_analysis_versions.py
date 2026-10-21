# ruff: noqa: F811

from uuid import uuid4

from app.clips.captions import captions_for_candidate
from app.clips.contracts import TranscriptSegment, TranscriptWord
from app.clips.service import ClipAnalysisService
from app.models.identity import TenantRecord
from sqlalchemy import select
from test_clip_service import candidate
from test_permission_groups_api import permission_client  # noqa: F401


def segment(text):
    return TranscriptSegment(
        start=0, end=2, text=text, words=[TranscriptWord(text=text, start=0, end=2)]
    )


def records(session, tenant_id, entity_type):
    return session.scalars(
        select(TenantRecord)
        .where(TenantRecord.tenant_id == tenant_id, TenantRecord.entity_type == entity_type)
        .order_by(TenantRecord.created_at.asc())
    ).all()


def add_asset(session, tenant_id):
    asset = TenantRecord(tenant_id=tenant_id, entity_type="Asset", data={"title": "Mídia"})
    session.add(asset)
    session.flush()
    return asset.id


def test_reprocessing_the_same_analysis_keeps_previous_results_as_versions(permission_client):
    _, ids = permission_client
    tenant = ids["tenant"]
    with ids["session_factory"]() as session:
        service = ClipAnalysisService(session)
        job = service.create(
            asset_id=add_asset(session, tenant), tenant_id=tenant, requested_by=uuid4()
        )
        first, second = candidate(), candidate()

        service.save_transcript(job.id, tenant, [segment("primeira")])
        service.save_candidates(job.id, tenant, [first], [captions_for_candidate(first)])
        service.save_transcript(job.id, tenant, [segment("segunda")])
        service.save_candidates(job.id, tenant, [second], [captions_for_candidate(second)])
        session.commit()

        transcripts = records(session, tenant, "ClipTranscript")
        assert [item.data["text"] for item in transcripts] == ["primeira", "segunda"]
        assert transcripts[0].data["superseded"] is True
        assert transcripts[0].data["revision"] == 1
        assert transcripts[0].data["superseded_by_revision"] == 2
        assert transcripts[0].data["superseded_at"]
        assert "superseded" not in transcripts[1].data
        assert transcripts[1].data["revision"] == 2

        candidates = records(session, tenant, "ClipCandidate")
        assert len(candidates) == 2
        assert candidates[0].data["superseded"] is True
        assert candidates[1].data["revision"] == 2

        analysis = service.get_analysis(job.id, tenant)
        assert analysis["transcript_revision"] == 2
        assert analysis["candidates_revision"] == 2
        assert [item["id"] for item in analysis["candidates"]] == [str(candidates[1].id)]


def test_new_analysis_of_same_asset_references_and_supersedes_previous_only_on_success(
    permission_client,
):
    _, ids = permission_client
    tenant = ids["tenant"]
    with ids["session_factory"]() as session:
        service = ClipAnalysisService(session)
        asset_id = add_asset(session, tenant)
        first = service.create(asset_id=asset_id, tenant_id=tenant, requested_by=uuid4())
        item = candidate()
        service.save_candidates(first.id, tenant, [item], [captions_for_candidate(item)])
        session.commit()

        failed = service.create(asset_id=asset_id, tenant_id=tenant, requested_by=uuid4())
        service.set_state(failed.id, tenant, "unavailable", "Sem provedor.")
        session.commit()
        # Reprocessamento que falhou não arquiva a análise válida anterior.
        assert failed.data["previous_analysis_id"] == str(first.id)
        assert failed.data["version"] == 2
        assert "superseded_by" not in first.data

        latest = service.create(asset_id=asset_id, tenant_id=tenant, requested_by=uuid4())
        assert latest.data["previous_analysis_id"] == str(first.id)
        assert latest.data["version"] == 3
        service.save_candidates(latest.id, tenant, [item], [captions_for_candidate(item)])
        session.commit()

        assert first.data["superseded_by"] == str(latest.id)
        assert first.data["superseded_at"]
        # A análise anterior continua consultável, com os próprios candidatos.
        previous = service.get_analysis(first.id, tenant)
        assert previous["superseded_by"] == str(latest.id)
        assert len(previous["candidates"]) == 1
        assert service.get_analysis(latest.id, tenant)["candidates"]
        # Os candidatos da análise substituída são arquivados (não apagados).
        old_rows = [
            row
            for row in records(session, tenant, "ClipCandidate")
            if row.data["analysis_id"] == str(first.id)
        ]
        assert len(old_rows) == 1
        assert old_rows[0].data["superseded"] is True
        assert old_rows[0].data["superseded_by_analysis"] == str(latest.id)
        assert old_rows[0].data["superseded_at"]


def test_versions_never_cross_companies(permission_client):
    _, ids = permission_client
    tenant, other = ids["tenant"], ids["other"]
    with ids["session_factory"]() as session:
        service = ClipAnalysisService(session)
        foreign_asset = add_asset(session, other)
        foreign = service.create(asset_id=foreign_asset, tenant_id=other, requested_by=uuid4())
        item = candidate()
        service.save_candidates(foreign.id, other, [item], [captions_for_candidate(item)])
        # Mesmo asset_id gravado no tenant atual (colisão de id não pode ligar análises).
        own_asset = TenantRecord(
            id=uuid4(), tenant_id=tenant, entity_type="Asset", data={"title": "Própria"}
        )
        session.add(own_asset)
        session.flush()
        foreign.data = {**foreign.data, "asset_id": str(own_asset.id)}
        session.flush()

        own = service.create(asset_id=own_asset.id, tenant_id=tenant, requested_by=uuid4())
        service.save_candidates(own.id, tenant, [item], [captions_for_candidate(item)])
        # Mesmo analysis_id em outra empresa não é arquivado pelo reprocessamento.
        session.add(
            TenantRecord(
                tenant_id=other,
                entity_type="ClipCandidate",
                data={"analysis_id": str(own.id), "text": "outra empresa"},
            )
        )
        session.flush()
        service.save_candidates(own.id, tenant, [item], [captions_for_candidate(item)])
        session.commit()

        assert "previous_analysis_id" not in own.data
        assert own.data["version"] == 1
        assert "superseded_by" not in foreign.data
        foreign_rows = records(session, other, "ClipCandidate")
        assert all("superseded" not in row.data for row in foreign_rows)
        assert service.get_analysis(own.id, other) is None


def test_concurrent_reprocessing_keeps_first_replacement_and_old_versions(permission_client):
    _, ids = permission_client
    tenant = ids["tenant"]
    with ids["session_factory"]() as session:
        service = ClipAnalysisService(session)
        asset_id = add_asset(session, tenant)
        item = candidate()
        first = service.create(asset_id=asset_id, tenant_id=tenant, requested_by=uuid4())
        service.save_candidates(first.id, tenant, [item], [captions_for_candidate(item)])
        # Duas análises iniciadas ao mesmo tempo apontam para a mesma anterior.
        left = service.create(asset_id=asset_id, tenant_id=tenant, requested_by=uuid4())
        right = service.create(asset_id=asset_id, tenant_id=tenant, requested_by=uuid4())
        assert left.data["previous_analysis_id"] == right.data["previous_analysis_id"]
        assert {left.data["version"], right.data["version"]} == {2, 3}

        service.save_candidates(left.id, tenant, [item], [captions_for_candidate(item)])
        service.save_candidates(right.id, tenant, [item], [captions_for_candidate(item)])
        # Terceira gravação na mesma análise não reescreve versões já arquivadas.
        for _ in range(2):
            service.save_candidates(right.id, tenant, [item], [captions_for_candidate(item)])
        session.commit()

        assert first.data["superseded_by"] == str(left.id)
        right_rows = [
            row
            for row in records(session, tenant, "ClipCandidate")
            if row.data["analysis_id"] == str(right.id)
        ]
        assert [row.data.get("superseded_by_revision") for row in right_rows] == [2, 3, None]


def test_generic_records_api_hides_superseded_candidates_by_default(permission_client):
    from test_permission_groups_api import login

    client, ids = permission_client
    tenant = ids["tenant"]
    with ids["session_factory"]() as session:
        service = ClipAnalysisService(session)
        asset_id = add_asset(session, tenant)
        job = service.create(asset_id=asset_id, tenant_id=tenant, requested_by=uuid4())
        old, new = candidate(), candidate()
        service.save_candidates(job.id, tenant, [old], [captions_for_candidate(old)])
        service.save_candidates(job.id, tenant, [new], [captions_for_candidate(new)])
        session.commit()
        current_id = str(records(session, tenant, "ClipCandidate")[1].id)
    login(client)

    def query(filters):
        response = client.post("/api/v1/records/ClipCandidate/query", json={"filters": filters})
        assert response.status_code == 200
        return response.json()["records"]

    by_analysis = query({"analysis_id": str(job.id)})
    assert [item["id"] for item in by_analysis] == [current_id]
    assert [item["id"] for item in query({})] == [current_id]
    listed = client.get("/api/v1/records/ClipCandidate").json()["records"]
    assert [item["id"] for item in listed] == [current_id]
    # Archived versions stay available when explicitly requested (nothing is deleted).
    archived = query({"analysis_id": str(job.id), "superseded": True})
    assert len(archived) == 1
    assert archived[0]["id"] != current_id


def test_generic_search_by_asset_returns_only_the_current_analysis(permission_client):
    from test_permission_groups_api import login

    client, ids = permission_client
    tenant, other = ids["tenant"], ids["other"]
    with ids["session_factory"]() as session:
        service = ClipAnalysisService(session)
        asset_id = add_asset(session, tenant)
        item = candidate()
        first = service.create(asset_id=asset_id, tenant_id=tenant, requested_by=uuid4())
        service.save_candidates(first.id, tenant, [item], [captions_for_candidate(item)])
        second = service.create(asset_id=asset_id, tenant_id=tenant, requested_by=uuid4())
        service.save_candidates(second.id, tenant, [item], [captions_for_candidate(item)])
        # Outra empresa com o mesmo asset_id gravado não aparece nem é arquivada.
        foreign = service.create(
            asset_id=add_asset(session, other), tenant_id=other, requested_by=uuid4()
        )
        service.save_candidates(foreign.id, other, [item], [captions_for_candidate(item)])
        foreign_row = records(session, other, "ClipCandidate")[0]
        foreign_row.data = {**foreign_row.data, "asset_id": str(asset_id)}
        session.commit()
        foreign_id = foreign_row.id
    login(client)

    def query(filters):
        response = client.post("/api/v1/records/ClipCandidate/query", json={"filters": filters})
        assert response.status_code == 200
        return response.json()["records"]

    current = query({"asset_id": str(asset_id)})
    assert [row["analysis_id"] for row in current] == [str(second.id)]
    archived = query({"asset_id": str(asset_id), "superseded": True})
    assert [row["analysis_id"] for row in archived] == [str(first.id)]
    assert archived[0]["superseded_by_analysis"] == str(second.id)
    with ids["session_factory"]() as session:
        assert "superseded" not in session.get(TenantRecord, foreign_id).data

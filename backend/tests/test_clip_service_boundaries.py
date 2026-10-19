# ruff: noqa: F811

from uuid import uuid4

import pytest
from app.clips.contracts import TranscriptSegment, TranscriptWord
from app.clips.service import ClipAnalysisService
from app.models.identity import TenantRecord
from sqlalchemy import select
from test_clip_service import candidate
from test_permission_groups_api import permission_client  # noqa: F401


def test_analysis_cannot_use_an_asset_from_another_company(permission_client):
    _, ids = permission_client
    with ids["session_factory"]() as session:
        asset = TenantRecord(tenant_id=ids["other"], entity_type="Asset", data={})
        session.add(asset)
        session.flush()

        with pytest.raises(LookupError, match="Asset not found"):
            ClipAnalysisService(session).create(
                asset_id=asset.id, tenant_id=ids["tenant"], requested_by=uuid4()
            )
        assert (
            session.scalars(
                select(TenantRecord).where(TenantRecord.entity_type == "ClipAnalysis")
            ).all()
            == []
        )


def test_invalid_analysis_state_does_not_change_the_saved_job(permission_client):
    _, ids = permission_client
    with ids["session_factory"]() as session:
        job = TenantRecord(
            tenant_id=ids["tenant"], entity_type="ClipAnalysis", data={"status": "queued"}
        )
        session.add(job)
        session.flush()

        with pytest.raises(ValueError, match="Invalid clip analysis state"):
            ClipAnalysisService(session).set_state(job.id, ids["tenant"], "unknown", "bad")
        assert job.data["status"] == "queued"


def test_another_company_cannot_update_analysis_state(permission_client):
    _, ids = permission_client
    with ids["session_factory"]() as session:
        job = TenantRecord(
            tenant_id=ids["tenant"], entity_type="ClipAnalysis", data={"status": "queued"}
        )
        session.add(job)
        session.flush()

        with pytest.raises(LookupError, match="not found"):
            ClipAnalysisService(session).set_state(job.id, ids["other"], "completed", "bad")
        assert job.data["status"] == "queued"


def test_mismatched_caption_lists_leave_existing_candidates_intact(permission_client):
    _, ids = permission_client
    with ids["session_factory"]() as session:
        job = TenantRecord(
            tenant_id=ids["tenant"], entity_type="ClipAnalysis", data={"status": "completed"}
        )
        session.add(job)
        session.flush()
        saved = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="ClipCandidate",
            data={"analysis_id": str(job.id), "quote": "original"},
        )
        session.add(saved)
        session.flush()

        with pytest.raises(ValueError, match="legendas"):
            ClipAnalysisService(session).save_candidates(job.id, ids["tenant"], [candidate()], [])
        assert session.get(TenantRecord, saved.id).data["quote"] == "original"
        assert job.data["status"] == "completed"


def test_replacing_transcript_does_not_change_another_company(permission_client):
    _, ids = permission_client
    with ids["session_factory"]() as session:
        job = TenantRecord(
            tenant_id=ids["tenant"], entity_type="ClipAnalysis", data={"status": "queued"}
        )
        session.add(job)
        session.flush()
        old = TenantRecord(
            tenant_id=ids["tenant"],
            entity_type="ClipTranscript",
            data={"analysis_id": str(job.id), "text": "antigo"},
        )
        other = TenantRecord(
            tenant_id=ids["other"],
            entity_type="ClipTranscript",
            data={"analysis_id": str(job.id), "text": "outra empresa"},
        )
        session.add_all([old, other])
        session.flush()
        old_id, other_id = old.id, other.id
        segment = TranscriptSegment(
            start=0, end=2, text="novo", words=[TranscriptWord(text="novo", start=0, end=2)]
        )

        ClipAnalysisService(session).save_transcript(job.id, ids["tenant"], [segment])
        session.flush()

        assert session.get(TenantRecord, old_id) is None
        assert session.get(TenantRecord, other_id).data["text"] == "outra empresa"
        records = session.scalars(
            select(TenantRecord).where(
                TenantRecord.tenant_id == ids["tenant"],
                TenantRecord.entity_type == "ClipTranscript",
            )
        ).all()
        assert [record.data["text"] for record in records] == ["novo"]
        assert job.data["status"] == "processing"

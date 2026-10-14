from uuid import uuid4

from app.clips.contracts import CandidateDimensions, TranscriptWord
from app.clips.scoring import build_candidate
from app.clips.service import ClipAnalysisService
from app.models.identity import Tenant, TenantRecord
from test_permission_groups_api import permission_client  # noqa: F401


def candidate():
    evidence = [
        TranscriptWord(text="Este", start=3, end=3.2),
        TranscriptWord(text="é", start=3.2, end=3.3),
        TranscriptWord(text="um", start=3.3, end=3.5),
        TranscriptWord(text="trecho", start=3.5, end=4),
    ]
    return build_candidate(
        start=3,
        end=28,
        evidence=evidence,
        dimensions=CandidateDimensions(hook=20, flow=20, value=20, shareability=20),
    )


def test_service_persists_evidence_and_hides_analysis_from_another_tenant(permission_client):
    _client, ids = permission_client
    session_factory = ids["session_factory"]
    asset_id = uuid4()
    with session_factory() as session:
        tenant = session.get(Tenant, ids["tenant"])
        session.add(TenantRecord(tenant_id=tenant.id, entity_type="Asset", data={"title": "Teste"}, id=asset_id))
        session.commit()
        service = ClipAnalysisService(session)
        job = service.create(asset_id=asset_id, tenant_id=tenant.id, requested_by=uuid4())
        service.save_candidates(job.id, tenant.id, [candidate()])
        session.commit()

        analysis = service.get_analysis(job.id, tenant.id)
        assert analysis is not None
        assert analysis["candidates"][0]["evidence"][0]["text"] == "Este"
        assert service.get_analysis(job.id, ids["other"]) is None

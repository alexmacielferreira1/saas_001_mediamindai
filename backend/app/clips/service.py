from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.clips.contracts import CaptionCue, ClipCandidate, TranscriptSegment
from app.models.identity import TenantRecord

ANALYSIS_ENTITY = "ClipAnalysis"
TRANSCRIPT_ENTITY = "ClipTranscript"
CANDIDATE_ENTITY = "ClipCandidate"
CAPTION_ENTITY = "ClipCaption"
JOB_STATES = {"queued", "processing", "completed", "failed", "unavailable"}


class ClipAnalysisService:
    def __init__(self, session: Session):
        self.session = session

    def create(self, *, asset_id: UUID, tenant_id: UUID, requested_by: UUID) -> TenantRecord:
        asset = self.session.scalar(
            select(TenantRecord).where(
                TenantRecord.id == asset_id,
                TenantRecord.tenant_id == tenant_id,
                TenantRecord.entity_type == "Asset",
            )
        )
        if asset is None:
            raise LookupError("Asset not found for tenant")
        analysis = TenantRecord(
            tenant_id=tenant_id,
            entity_type=ANALYSIS_ENTITY,
            data={
                "asset_id": str(asset_id),
                "requested_by": str(requested_by),
                "status": "queued",
                "message": "Aguardando análise da mídia.",
            },
        )
        self.session.add(analysis)
        self.session.flush()
        return analysis

    def get_analysis(self, analysis_id: UUID, tenant_id: UUID) -> dict | None:
        analysis = self._analysis(analysis_id, tenant_id)
        if analysis is None:
            return None
        candidates = list(
            self.session.scalars(
                select(TenantRecord)
                .where(
                    TenantRecord.tenant_id == tenant_id,
                    TenantRecord.entity_type == CANDIDATE_ENTITY,
                    TenantRecord.data["analysis_id"].as_string() == str(analysis_id),
                )
                .order_by(TenantRecord.created_at.asc())
            )
        )
        return {
            "id": str(analysis.id),
            **analysis.data,
            "created_at": analysis.created_at.isoformat(),
            "updated_at": analysis.updated_at.isoformat(),
            "candidates": [self._serialize(record) for record in candidates],
        }

    def save_transcript(
        self, analysis_id: UUID, tenant_id: UUID, segments: list[TranscriptSegment]
    ) -> None:
        analysis = self._require_analysis(analysis_id, tenant_id)
        self._delete_for_analysis(TRANSCRIPT_ENTITY, analysis_id, tenant_id)
        for index, segment in enumerate(segments):
            self.session.add(
                TenantRecord(
                    tenant_id=tenant_id,
                    entity_type=TRANSCRIPT_ENTITY,
                    data={
                        "analysis_id": str(analysis_id),
                        "index": index,
                        **segment.model_dump(mode="json"),
                    },
                )
            )
        analysis.data = {
            **analysis.data,
            "status": "processing",
            "message": "Transcrição concluída.",
        }
        self.session.flush()

    def save_candidates(
        self,
        analysis_id: UUID,
        tenant_id: UUID,
        candidates: list[ClipCandidate],
        captions: list[list[CaptionCue]],
    ) -> None:
        if len(candidates) != len(captions):
            raise ValueError("Cada candidato deve manter as próprias legendas.")
        analysis = self._require_analysis(analysis_id, tenant_id)
        self._delete_for_analysis(CANDIDATE_ENTITY, analysis_id, tenant_id)
        for index, candidate in enumerate(candidates):
            self.session.add(
                TenantRecord(
                    tenant_id=tenant_id,
                    entity_type=CANDIDATE_ENTITY,
                    data={
                        "analysis_id": str(analysis_id),
                        "position": index,
                        "status": "suggested",
                        **candidate.model_dump(mode="json"),
                        "captions": [cue.model_dump(mode="json") for cue in captions[index]],
                    },
                )
            )
        analysis.data = {
            **analysis.data,
            "status": "completed",
            "message": "Sugestões baseadas na transcrição estão prontas.",
        }
        self.session.flush()

    def set_state(self, analysis_id: UUID, tenant_id: UUID, state: str, message: str) -> None:
        if state not in JOB_STATES:
            raise ValueError("Invalid clip analysis state")
        analysis = self._require_analysis(analysis_id, tenant_id)
        analysis.data = {**analysis.data, "status": state, "message": message}
        self.session.flush()

    def _analysis(self, analysis_id: UUID, tenant_id: UUID) -> TenantRecord | None:
        return self.session.scalar(
            select(TenantRecord).where(
                TenantRecord.id == analysis_id,
                TenantRecord.tenant_id == tenant_id,
                TenantRecord.entity_type == ANALYSIS_ENTITY,
            )
        )

    def _require_analysis(self, analysis_id: UUID, tenant_id: UUID) -> TenantRecord:
        analysis = self._analysis(analysis_id, tenant_id)
        if analysis is None:
            raise LookupError("Clip analysis not found for tenant")
        return analysis

    def _delete_for_analysis(self, entity_type: str, analysis_id: UUID, tenant_id: UUID) -> None:
        records = self.session.scalars(
            select(TenantRecord).where(
                TenantRecord.tenant_id == tenant_id,
                TenantRecord.entity_type == entity_type,
                TenantRecord.data["analysis_id"].as_string() == str(analysis_id),
            )
        )
        for record in records:
            self.session.delete(record)

    @staticmethod
    def _serialize(record: TenantRecord) -> dict:
        return {"id": str(record.id), **record.data}

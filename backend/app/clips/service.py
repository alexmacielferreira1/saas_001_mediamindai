from datetime import UTC, datetime
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
        history = self._analyses_for_asset(asset_id, tenant_id)
        # A nova versão aponta para a última análise concluída e ainda vigente.
        previous = max(
            (
                item
                for item in history
                if item.data.get("status") == "completed" and not item.data.get("superseded_by")
            ),
            key=self._version_key,
            default=None,
        )
        version = max((item.data.get("version") or 1 for item in history), default=0) + 1
        analysis = TenantRecord(
            tenant_id=tenant_id,
            entity_type=ANALYSIS_ENTITY,
            data={
                "asset_id": str(asset_id),
                "requested_by": str(requested_by),
                "status": "queued",
                "message": "Aguardando análise da mídia.",
                "version": version,
                **({"previous_analysis_id": str(previous.id)} if previous else {}),
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
        # Uma análise substituída por outra continua mostrando os próprios candidatos;
        # só as revisões antigas dentro da mesma análise ficam de fora.
        current = [
            record
            for record in candidates
            if not record.data.get("superseded") or record.data.get("superseded_by_analysis")
        ]
        return {
            "id": str(analysis.id),
            **analysis.data,
            "created_at": analysis.created_at.isoformat(),
            "updated_at": analysis.updated_at.isoformat(),
            "candidates": [self._serialize(record) for record in current],
        }

    def save_transcript(
        self, analysis_id: UUID, tenant_id: UUID, segments: list[TranscriptSegment]
    ) -> None:
        analysis = self._require_analysis(analysis_id, tenant_id)
        revision = (analysis.data.get("transcript_revision") or 0) + 1
        self._supersede_for_analysis(TRANSCRIPT_ENTITY, analysis_id, tenant_id, revision)
        for index, segment in enumerate(segments):
            self.session.add(
                TenantRecord(
                    tenant_id=tenant_id,
                    entity_type=TRANSCRIPT_ENTITY,
                    data={
                        "analysis_id": str(analysis_id),
                        "index": index,
                        "revision": revision,
                        **segment.model_dump(mode="json"),
                    },
                )
            )
        analysis.data = {
            **analysis.data,
            "status": "processing",
            "message": "Transcrição concluída.",
            "transcript_revision": revision,
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
        revision = (analysis.data.get("candidates_revision") or 0) + 1
        asset_id = analysis.data.get("asset_id")
        self._supersede_for_analysis(CANDIDATE_ENTITY, analysis_id, tenant_id, revision)
        for index, candidate in enumerate(candidates):
            self.session.add(
                TenantRecord(
                    tenant_id=tenant_id,
                    entity_type=CANDIDATE_ENTITY,
                    data={
                        "analysis_id": str(analysis_id),
                        # Permite a busca genérica por asset (``ClipCandidate`` + ``asset_id``).
                        **({"asset_id": asset_id} if asset_id else {}),
                        "position": index,
                        "revision": revision,
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
            "candidates_revision": revision,
        }
        self._supersede_previous_analysis(analysis, tenant_id)
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

    @staticmethod
    def _version_key(item: TenantRecord) -> tuple:
        return (item.data.get("version") or 1, item.created_at)

    def _analyses_for_asset(self, asset_id: UUID, tenant_id: UUID) -> list[TenantRecord]:
        return list(
            self.session.scalars(
                select(TenantRecord).where(
                    TenantRecord.tenant_id == tenant_id,
                    TenantRecord.entity_type == ANALYSIS_ENTITY,
                    TenantRecord.data["asset_id"].as_string() == str(asset_id),
                )
            )
        )

    def _supersede_previous_analysis(self, analysis: TenantRecord, tenant_id: UUID) -> None:
        """Arquiva a análise anterior do mesmo asset somente quando a nova conclui."""
        previous_id = analysis.data.get("previous_analysis_id")
        if not previous_id:
            return
        previous = self._analysis(UUID(previous_id), tenant_id)
        if previous is None or previous.data.get("superseded_by"):
            return
        superseded_at = datetime.now(UTC).isoformat()
        previous.data = {
            **previous.data,
            "superseded_by": str(analysis.id),
            "superseded_at": superseded_at,
        }
        # Os candidatos vigentes da análise anterior também saem da lista atual do asset
        # (busca genérica), mas continuam gravados e visíveis na análise antiga.
        self._mark_superseded(
            CANDIDATE_ENTITY,
            previous.id,
            tenant_id,
            {"superseded_at": superseded_at, "superseded_by_analysis": str(analysis.id)},
        )

    def _supersede_for_analysis(
        self, entity_type: str, analysis_id: UUID, tenant_id: UUID, revision: int
    ) -> None:
        """Preserva resultados anteriores como versão substituída (nunca apaga)."""
        self._mark_superseded(
            entity_type,
            analysis_id,
            tenant_id,
            {
                "superseded_at": datetime.now(UTC).isoformat(),
                "superseded_by_revision": revision,
            },
        )

    def _mark_superseded(
        self, entity_type: str, analysis_id: UUID, tenant_id: UUID, marker: dict
    ) -> None:
        records = self.session.scalars(
            select(TenantRecord).where(
                TenantRecord.tenant_id == tenant_id,
                TenantRecord.entity_type == entity_type,
                TenantRecord.data["analysis_id"].as_string() == str(analysis_id),
            )
        )
        for record in records:
            if record.data.get("superseded"):
                continue
            record.data = {**record.data, "superseded": True, **marker}

    @staticmethod
    def _serialize(record: TenantRecord) -> dict:
        return {"id": str(record.id), **record.data}

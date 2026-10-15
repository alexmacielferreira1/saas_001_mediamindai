# CLIPSFREE Real Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform CLIPSFREE from simulated suggestions into a tenant-safe workflow that finds transcript-grounded, short viral candidates, produces editable captions, and exports the selected result.

**Architecture:** The native MediaMind backend owns analysis jobs, transcript segments, candidate evidence, and caption data using the existing tenant-record infrastructure. A provider boundary extracts audio and transcribes it, then another provider evaluates transcript windows; neither may fabricate a candidate when a dependency is unavailable. The React flow consumes those native endpoints and renders job progress, evidence, captions, and exports from the same persisted records.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy/TenantRecord, local media storage and FFmpeg, provider adapters, React, Vite, Vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-10-14-clipsfree-real-analysis-design.md`

## Global Constraints

- Keep every asset, analysis, transcript, candidate, and export tenant-scoped through the current MediaMind authorization model.
- Do not use random ranges, hardcoded scores, demo transcripts, or invented captions in a real analysis path.
- A candidate must cite persisted transcript timestamps and preserve a playable start/end range.
- Prefer 25–50 second clips; allow 15–60 seconds only when the transcript boundary supports it.
- If transcription, analysis, or a source file is unavailable, return a clear non-success state and create no fabricated candidate.
- Use `supoclip-main.zip` only as behavioural reference. Do not copy its AGPL-licensed source, assets, or wording into MediaMind.
- Reuse the configured organization AI boundary without reading or changing the IA-settings endpoints owned by the concurrent configuration work.
- Preserve unrelated local edits; do not reset, overwrite, or stage work outside the files and hunks owned by this feature.
- Keep MCP Express and MCP panels out of CLIPSFREE; their present scope remains Ferramentas Gráficas.

## Review Focus

- A video with no audio stream must end as `failed` with a useful explanation rather than show candidate cards; Task 3 pins this with an FFmpeg probe failure test.
- A tenant without a transcription or analysis provider must see `unavailable` and zero candidates; Task 4 pins both provider-unavailable paths.
- A transcript with gaps, overlapping timestamps, or non-monotonic words must be rejected before scoring; Task 1 pins normalization and validation.
- A candidate that would exceed 60 seconds or has no quoted transcript evidence must be rejected rather than silently clipped; Task 2 pins the boundary rule.
- A user from another tenant must not read, alter, caption, or export an analysis by guessed ID; Task 5 pins all four route classes.

---

## File Structure

- `backend/app/clips/contracts.py` — immutable transcript, candidate, caption, score, and job Pydantic contracts.
- `backend/app/clips/scoring.py` — deterministic evidence validation and composed score calculation.
- `backend/app/clips/transcription.py` — audio extraction and pluggable transcription adapter interface.
- `backend/app/clips/analysis.py` — transcript-window analysis adapter interface and candidate normalization.
- `backend/app/clips/service.py` — tenant-record persistence and job lifecycle orchestration.
- `backend/app/api/v1/clips.py` — authenticated HTTP API for analyses, candidates, captions, and exports.
- `backend/app/api/v1/__init__.py` — router registration only.
- `backend/tests/clips/` — unit, service, and route tests for the native workflow.
- `frontend/src/mediamind/lib/clipEngineService.js` — native API client, replacing Base44 calls for this workflow.
- `frontend/src/mediamind/pages/ClipsFree.jsx` — upload, analysis state, evidence, and real empty/error states.
- `frontend/src/mediamind/components/corp/recortes/ClipCandidatesPanel.jsx` — persisted candidate list and selection.
- `frontend/src/mediamind/components/corp/recortes/ClipLegendasPanel.jsx` — editable captions sourced only from persisted transcript words.
- `frontend/src/mediamind/components/corp/recortes/ClipWorkspace.jsx` and `clipModel.js` — removal of static analysis text and random legacy generators from active paths.
- `frontend/src/mediamind/**/ClipsFree*.test.jsx` and `components/corp/recortes/*.test.jsx` — interaction regressions.

### Task 1: Define transcript and candidate contracts with deterministic scoring

**Files:**
- Create: `backend/app/clips/__init__.py`
- Create: `backend/app/clips/contracts.py`
- Create: `backend/app/clips/scoring.py`
- Test: `backend/tests/clips/test_scoring.py`

**Interfaces:**
- Consumes: timestamped provider words as `list[TranscriptWord]`.
- Produces: `normalize_transcript(words: list[TranscriptWord]) -> list[TranscriptWord]` and `build_candidate(start: float, end: float, evidence: list[TranscriptWord], dimensions: CandidateDimensions) -> ClipCandidate`.

- [ ] **Step 1: Write failing contract tests**

```python
def test_build_candidate_rejects_a_range_without_evidence_or_outside_allowed_duration():
    with pytest.raises(ValueError, match="evidence"):
        build_candidate(0, 31, [], dimensions())
    with pytest.raises(ValueError, match="60"):
        build_candidate(0, 61, words(), dimensions())
```

- [ ] **Step 2: Run the contract tests to verify they fail**

Run: `pytest backend/tests/clips/test_scoring.py -v`

Expected: FAIL because the clips contracts and scorer do not exist.

- [ ] **Step 3: Implement the contracts and scorer**

Implement `TranscriptWord`, `TranscriptSegment`, `CandidateDimensions`, `ClipCandidate`, and `CaptionCue` in `contracts.py`. Implement monotonic timestamp validation plus `score = hook + flow + value + shareability` in `scoring.py`; retain each dimension and rationale so the UI can explain the score. The scorer must not use randomness and must only accept evidence within the selected range.

- [ ] **Step 4: Run the contract tests to verify they pass**

Run: `pytest backend/tests/clips/test_scoring.py -v`

Expected: PASS, including gap/overlap rejection and 15–60 second boundary checks.

- [ ] **Step 5: Commit the isolated domain layer**

```bash
git add backend/app/clips backend/tests/clips/test_scoring.py
git commit -m "feat(clips): add transcript grounded candidate scoring"
```

### Task 2: Persist jobs, transcript evidence, and candidate state natively

**Files:**
- Create: `backend/app/clips/service.py`
- Create: `backend/tests/clips/test_service.py`
- Modify: `backend/app/tenancy/record_policies.py`

**Interfaces:**
- Consumes: `ClipAnalysisService.create(asset_id: UUID, tenant_id: UUID, requested_by: UUID) -> ClipAnalysisJob` and Task 1 contracts.
- Produces: `get_analysis`, `save_transcript`, `save_candidates`, `update_candidate`, and `list_captions` methods backed by tenant records.

- [ ] **Step 1: Write failing persistence and tenant-isolation tests**

```python
def test_save_candidates_keeps_the_evidence_and_hides_it_from_another_tenant(service):
    job = service.create(asset_id=asset.id, tenant_id=tenant_a.id, requested_by=user_a.id)
    service.save_candidates(job.id, [candidate])
    assert service.get_analysis(job.id, tenant_a.id).candidates[0].evidence
    assert service.get_analysis(job.id, tenant_b.id) is None
```

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `pytest backend/tests/clips/test_service.py -v`

Expected: FAIL because no native clip-analysis persistence exists.

- [ ] **Step 3: Implement the service and record policies**

Persist `ClipAnalysis`, `TranscriptSegment`, `ClipCandidate`, `ClipCaption`, and `ClipAnalysisJob` in the current `TenantRecord` pattern. Job states are exactly `queued`, `processing`, `completed`, `failed`, and `unavailable`; a failure has a user-safe message and no fallback candidates. Add the minimum record-policy entries required for owner/admin access and clip write permissions.

- [ ] **Step 4: Run the service tests to verify they pass**

Run: `pytest backend/tests/clips/test_service.py -v`

Expected: PASS, including tenant isolation and no candidate without transcript evidence.

- [ ] **Step 5: Commit native persistence**

```bash
git add backend/app/clips/service.py backend/app/tenancy/record_policies.py backend/tests/clips/test_service.py
git commit -m "feat(clips): persist analysis jobs and evidence"
```

### Task 3: Add a real audio and transcription adapter boundary

**Files:**
- Create: `backend/app/clips/transcription.py`
- Create: `backend/tests/clips/test_transcription.py`
- Modify: `backend/app/clips/service.py`

**Interfaces:**
- Consumes: `TranscriptionAdapter.transcribe(source_path: Path, language: str | None) -> list[TranscriptSegment]`.
- Produces: `extract_audio(source_path: Path, output_path: Path) -> Path` and `ClipAnalysisService.transcribe(job_id: UUID) -> ClipAnalysisJob`.

- [ ] **Step 1: Write failing adapter tests**

```python
def test_transcribe_marks_job_failed_when_ffmpeg_cannot_find_an_audio_stream(service, asset):
    job = service.create(asset.id, tenant.id, user.id)
    service.transcribe(job.id)
    assert service.get_analysis(job.id, tenant.id).status == "failed"
    assert service.list_candidates(job.id, tenant.id) == []
```

- [ ] **Step 2: Run the adapter tests to verify they fail**

Run: `pytest backend/tests/clips/test_transcription.py -v`

Expected: FAIL because no transcription adapter or failure mapping exists.

- [ ] **Step 3: Implement extraction and provider adapters**

Use the existing server-side media storage and FFmpeg process conventions to extract a temporary mono audio file. Define a provider adapter chosen through existing server configuration, with an explicit unavailable adapter for deployments that have no configured transcription service. Convert provider output into Task 1 contracts and persist it through Task 2; never substitute title, summary, or sample text for transcript words.

- [ ] **Step 4: Run the adapter tests to verify they pass**

Run: `pytest backend/tests/clips/test_transcription.py -v`

Expected: PASS for success, no-audio failure, and provider-unavailable state.

- [ ] **Step 5: Commit the transcription boundary**

```bash
git add backend/app/clips/transcription.py backend/app/clips/service.py backend/tests/clips/test_transcription.py
git commit -m "feat(clips): add real transcription job adapter"
```

### Task 4: Analyze transcript windows through a configured AI provider

**Files:**
- Create: `backend/app/clips/analysis.py`
- Create: `backend/tests/clips/test_analysis.py`
- Modify: `backend/app/clips/service.py`

**Interfaces:**
- Consumes: `ClipAnalysisAdapter.suggest(segments: list[TranscriptSegment], profile: ClipProfile) -> list[CandidateProposal]`.
- Produces: `ClipAnalysisService.analyze(job_id: UUID, profile: ClipProfile) -> ClipAnalysisJob` with persisted Task 1 candidates.

- [ ] **Step 1: Write failing analysis tests with a fake provider only in the test**

```python
def test_analyze_only_saves_provider_proposals_that_map_to_real_transcript_words(service):
    service.analyze(job.id, ClipProfile())
    candidate = service.list_candidates(job.id, tenant.id)[0]
    assert 15 <= candidate.duration <= 60
    assert candidate.quote in transcript_text
    assert candidate.score == sum(candidate.dimensions.values())
```

- [ ] **Step 2: Run the analysis tests to verify they fail**

Run: `pytest backend/tests/clips/test_analysis.py -v`

Expected: FAIL because there is no analysis adapter or window validator.

- [ ] **Step 3: Implement analysis orchestration**

Split long transcripts into overlapping windows, call the configured organization AI provider through an adapter boundary, and map proposals back to exact persisted words. Reject proposals with unsupported timecodes, missing rationale, missing quote, or invalid duration. Mark the job `unavailable` when no analysis provider is configured; do not generate placeholders. Keep a future worker-compatible `process(job_id)` entry point while local development can schedule it through FastAPI background execution.

- [ ] **Step 4: Run the analysis tests to verify they pass**

Run: `pytest backend/tests/clips/test_analysis.py -v`

Expected: PASS, including unavailable-provider, transcript grounding, and deterministic score coverage.

- [ ] **Step 5: Commit real candidate analysis**

```bash
git add backend/app/clips/analysis.py backend/app/clips/service.py backend/tests/clips/test_analysis.py
git commit -m "feat(clips): analyze grounded viral candidates"
```

### Task 5: Expose the authenticated native CLIPSFREE API

**Files:**
- Create: `backend/app/api/v1/clips.py`
- Modify: `backend/app/api/v1/__init__.py`
- Create: `backend/tests/api/test_clips_api.py`

**Interfaces:**
- Consumes: Tasks 2–4 `ClipAnalysisService` methods.
- Produces: `POST /api/v1/clips/analyses`, `GET /api/v1/clips/analyses/{asset_id}`, `PATCH /api/v1/clips/candidates/{candidate_id}`, `GET/PATCH /api/v1/clips/candidates/{candidate_id}/captions`, and `POST /api/v1/clips/candidates/{candidate_id}/export`.

- [ ] **Step 1: Write failing API tests**

```python
def test_other_tenant_cannot_read_or_export_a_candidate(client, candidate_from_tenant_a):
    assert client.get(f"/api/v1/clips/candidates/{candidate_from_tenant_a.id}").status_code == 404
    assert client.post(f"/api/v1/clips/candidates/{candidate_from_tenant_a.id}/export").status_code == 404
```

- [ ] **Step 2: Run the API tests to verify they fail**

Run: `pytest backend/tests/api/test_clips_api.py -v`

Expected: FAIL because the clips router is not registered.

- [ ] **Step 3: Implement routes and export integration**

Authenticate every route with the existing dependency pattern. Start a persisted job and return `202` from analysis creation; return its real state on polling. Permit caption edits only for persisted word-aligned cues. Reuse the existing media export implementation for selected candidate boundaries and store resulting versions as tenant records. Return typed `409` states for unavailable providers and failed jobs.

- [ ] **Step 4: Run the API tests to verify they pass**

Run: `pytest backend/tests/api/test_clips_api.py -v`

Expected: PASS for lifecycle, caption edit, export hand-off, failed jobs, and tenant isolation.

- [ ] **Step 5: Commit the native API**

```bash
git add backend/app/api/v1/clips.py backend/app/api/v1/__init__.py backend/tests/api/test_clips_api.py
git commit -m "feat(clips): expose native analysis and captions API"
```

### Task 6: Migrate the CLIPSFREE client to native job data

**Files:**
- Modify: `frontend/src/mediamind/lib/clipEngineService.js`
- Modify: `frontend/src/mediamind/pages/ClipsFree.jsx`
- Modify: `frontend/src/mediamind/pages/ClipsFree.test.jsx`

**Interfaces:**
- Consumes: Task 5 endpoints and current native media-upload client.
- Produces: `startClipAnalysis(assetId, profile)`, `getClipAnalysis(assetId)`, `updateClipCandidate`, `getCaptions`, `updateCaptions`, and `exportClipCandidate`.

- [ ] **Step 1: Write failing page tests for the native lifecycle**

```jsx
it("shows processing then real grounded candidates after upload", async () => {
  render(<ClipsFree />)
  await userEvent.upload(screen.getByLabelText(/arquivo/i), videoFile)
  await userEvent.click(screen.getByRole("button", { name: /analisar/i }))
  expect(await screen.findByText(/analisando transcrição/i)).toBeVisible()
  expect(await screen.findByText(/evidência no trecho/i)).toBeVisible()
})
```

- [ ] **Step 2: Run the page tests to verify they fail**

Run: `npm --prefix frontend test -- --run src/mediamind/pages/ClipsFree.test.jsx`

Expected: FAIL because the page still depends on local/mock suggestions.

- [ ] **Step 3: Replace Base44 and local suggestion dependencies**

Adapt the service to the project’s native authenticated request helper and media uploader. Poll only while a job is `queued` or `processing`; render real failed/unavailable/empty states. Do not show a score, note, caption, or candidate until the corresponding native record exists.

- [ ] **Step 4: Run the page tests to verify they pass**

Run: `npm --prefix frontend test -- --run src/mediamind/pages/ClipsFree.test.jsx`

Expected: PASS for upload, processing, unavailable, failure, and real candidate display.

- [ ] **Step 5: Commit the client migration**

```bash
git add frontend/src/mediamind/lib/clipEngineService.js frontend/src/mediamind/pages/ClipsFree.jsx frontend/src/mediamind/pages/ClipsFree.test.jsx
git commit -m "feat(clips): use native analysis lifecycle in clipsfree"
```

### Task 7: Remove simulation from candidate, workspace, and caption surfaces

**Files:**
- Modify: `frontend/src/mediamind/components/corp/recortes/ClipCandidatesPanel.jsx`
- Modify: `frontend/src/mediamind/components/corp/recortes/ClipLegendasPanel.jsx`
- Modify: `frontend/src/mediamind/components/corp/recortes/ClipWorkspace.jsx`
- Modify: `frontend/src/mediamind/components/corp/recortes/clipModel.js`
- Modify: `frontend/src/mediamind/components/corp/recortes/ClipViralPanel.jsx`
- Test: `frontend/src/mediamind/components/corp/recortes/ClipLegendasPanel.test.jsx`
- Create: `frontend/src/mediamind/components/corp/recortes/ClipCandidatesPanel.test.jsx`

**Interfaces:**
- Consumes: Task 6 native client methods and persisted candidates/captions.
- Produces: a selected candidate whose player range, evidence, score rationale, caption editor, and export action all refer to one candidate ID.

- [ ] **Step 1: Write failing interaction tests**

```jsx
it("builds editable caption cues from persisted transcript words, never from title text", async () => {
  render(<ClipLegendasPanel candidate={candidateWithCues} />)
  expect(screen.getByDisplayValue("fala transcrita")).toBeVisible()
  expect(screen.queryByText(candidateWithCues.title)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run component tests to verify they fail**

Run: `npm --prefix frontend test -- --run src/mediamind/components/corp/recortes/ClipLegendasPanel.test.jsx src/mediamind/components/corp/recortes/ClipCandidatesPanel.test.jsx`

Expected: FAIL because static transcript text, demo candidates, and legacy generators remain in the active UI.

- [ ] **Step 3: Remove fake active paths and wire real records**

Delete `DEMO_CANDIDATES` use, hardcoded analysis summary/transcript strings, and calls to random `gerarVirais` or title-based `gerarLegendas` from active CLIPSFREE navigation. Keep legacy helpers only if another route still needs them and clearly isolate them from the native flow; otherwise remove them. Show quoted evidence, score dimensions, exact player range, and editable caption cues for the selected record.

- [ ] **Step 4: Run component tests to verify they pass**

Run: `npm --prefix frontend test -- --run src/mediamind/components/corp/recortes/ClipLegendasPanel.test.jsx src/mediamind/components/corp/recortes/ClipCandidatesPanel.test.jsx`

Expected: PASS, including individual candidate playback/export selection and caption persistence.

- [ ] **Step 5: Commit real UI surfaces**

```bash
git add frontend/src/mediamind/components/corp/recortes
git commit -m "fix(clips): remove simulated candidates and captions"
```

### Task 8: Verify, document operation, and prepare a safe release hand-off

**Files:**
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `project-status.json`
- Create: `docs/CLIPSFREE_OPERATIONS.md`
- Modify: `docs/superpowers/specs/2026-10-14-clipsfree-real-analysis-design.md`

**Interfaces:**
- Consumes: completed Tasks 1–7 and project test-report conventions.
- Produces: operator setup instructions, explicit unavailable-state guidance, rollback notes, and current status evidence.

- [ ] **Step 1: Write a verification checklist before final tests**

Document one representative asset for each result: completed transcript/candidates, no-audio failure, provider-unavailable state, caption edit, export, and cross-tenant denial. Record expected visible UI text and API state.

- [ ] **Step 2: Run focused frontend and backend suites**

Run: `pytest backend/tests/clips backend/tests/api/test_clips_api.py -v` then `npm --prefix frontend test -- --run src/mediamind/pages/ClipsFree.test.jsx src/mediamind/components/corp/recortes/ClipLegendasPanel.test.jsx src/mediamind/components/corp/recortes/ClipCandidatesPanel.test.jsx`

Expected: PASS with no simulated candidate fixture used by a production component.

- [ ] **Step 3: Run the repository report only when no other report is active**

Run: `scripts/test-report.ps1`

Expected: a new completed report with the actual coverage and failures recorded; do not claim the user’s 95% target until its report proves it.

- [ ] **Step 4: Document status and rollback**

Describe provider prerequisites, media-format limitations, job retry behaviour, no-AI failure presentation, and rollback as route/client feature removal without deleting existing media records. Update status files with measured evidence, not projected completion.

- [ ] **Step 5: Commit the verification and documentation**

```bash
git add docs/PROJECT_STATUS.md project-status.json docs/CLIPSFREE_OPERATIONS.md docs/superpowers/specs/2026-10-14-clipsfree-real-analysis-design.md
git commit -m "docs: document clipsfree real analysis operations"
```

## Self-Review

- Spec coverage: Tasks 1–5 cover real, grounded discovery; Tasks 6–7 replace simulated UI and make captions editable; Task 5 reuses real export; Task 8 provides evidence and rollback. No specification requirement is left without a task.
- Type consistency: all layers use `ClipAnalysisJob`, `ClipCandidate`, `TranscriptSegment`, and candidate IDs; frontend methods align exactly with Task 5 route responsibilities.
- Risk coverage: every Review Focus condition is assigned to Tasks 1–5 and has a named test requirement.
- Scope: automated social publication, guarantees of virality, Adobe/MCP functionality, and copied Supoclip code remain intentionally out of scope.

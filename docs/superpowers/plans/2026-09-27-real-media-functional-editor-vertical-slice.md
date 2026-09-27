# Real Media and Functional Editor Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a demonstrable local journey from choosing real media through Acervo/Ingest, editing it with functional Timeline controls, saving/reopening the project, and exporting a real result without depending on AI.

**Architecture:** A tenant-scoped local media service stores binaries below `.runtime/media` and records metadata in the existing `TenantRecord` domain. A shared editor document and command layer power Workspace 2 and Timeline 2; a shared player/compositor synchronizes playback with the playhead. FFmpeg/FFprobe are configured local executables behind an adapter so the later storage/render infrastructure can replace them without changing the UI.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, PostgreSQL, pytest, React 18, Vite, Vitest, Testing Library, HTMLMediaElement, local FFmpeg/FFprobe.

**Spec:** `docs/superpowers/specs/2026-09-27-mediamind-editor-operations-ai-edita-integration-design.md`

## Global Constraints

- Preserve every existing MediaMind route and capability until an explicit compatibility redirect is tested.
- Operational screens must not depend on mock arrays, fictitious media paths, or simulated success responses.
- Store local binary media only below `.runtime/media/<tenant-id>/<asset-id>/`; never expose physical paths to the browser.
- Keep originals immutable and edit only through non-destructive project documents.
- Every visible enabled editor action must mutate persisted state or invoke a real backend operation.
- AI failure must not block upload, ingest, playback, editing, save/reopen, or local export.
- Do not publish or change GitHub, Render, Neon, or production without explicit authorization.
- Use TDD, small commits, full regression checks, and a documented rollback for each deliverable.

## Review Focus

- Interrupted/oversized upload: no partial Asset record or orphan final file; covered by Task 2 backend tests.
- Cross-tenant media URL: return 404 and never leak existence; covered by Task 3 streaming tests.
- Unsupported browser codec: preserve original and expose `proxy_pending`/actionable failure rather than a broken player; covered by Task 3 processor tests.
- Timeline under zoom/scroll/layer overlap: pointer-to-time and pointer-to-track remain correct; covered by Task 7 interaction tests.
- Reload during autosave/export: last confirmed revision remains recoverable and export is not duplicated; covered by Tasks 5 and 10.

---

## File Structure

### Backend

- `backend/app/media/storage.py`: tenant-safe local storage adapter and atomic file promotion.
- `backend/app/media/probe.py`: configurable FFprobe metadata extraction and FFmpeg proxy/thumbnail helpers.
- `backend/app/media/assets.py`: create/query Asset `TenantRecord` values and public serialization.
- `backend/app/media/render.py`: translate the supported editor document into a deterministic FFmpeg command and produce a derived Asset.
- `backend/app/api/v1/media.py`: upload, list, stream, project save/load, and export endpoints.
- `backend/app/core/config.py`: local media root and FFmpeg/FFprobe executable settings.
- `backend/app/api/v1/__init__.py`: register media router.
- `backend/app/api/v1/uploads.py`: compatibility delegation from the existing upload endpoint.
- `backend/app/api/v1/records.py`: admit `IngestPackage` and keep explicit permission mapping.
- `backend/app/tenancy/record_policies.py`: `IngestPackage` write permission.
- `backend/tests/test_media_api.py`: storage, upload, tenant isolation, Range, project and export contract tests.
- `backend/tests/test_media_probe.py`: probe/proxy success and missing-executable behavior.
- `backend/tests/test_media_render.py`: command translation and idempotent derived asset tests.

### Frontend

- `frontend/src/api/media.js`: typed-by-convention API facade for assets, projects and exports.
- `frontend/src/mediamind/hooks/useMediaAssets.js`: real asset list/upload state shared by Acervo, Ingest and editor.
- `frontend/src/mediamind/hooks/useEditorProject.js`: persisted project, revisions, autosave, undo/redo and conflict state.
- `frontend/src/mediamind/lib/editorDocument.js`: schema normalization, Workspace conversion and pure editor commands.
- `frontend/src/mediamind/components/editor/MediaPlayer.jsx`: shared real audio/video playback surface.
- `frontend/src/mediamind/components/editor/TimelineCanvas.jsx`: ruler, playhead, tracks, clips, pointer and drag behavior.
- `frontend/src/mediamind/components/editor/EditorToolbar.jsx`: enabled functional tools and disabled explanatory future tools.
- `frontend/src/mediamind/components/editor/EditorInspector.jsx`: real selected-element properties.
- `frontend/src/mediamind/pages/Timeline2.jsx`: editor composition only; remove mock/local-blob business logic.
- `frontend/src/mediamind/components/IngestNewPackage.jsx`: use real asset upload and persist package.
- `frontend/src/mediamind/components/IngestList.jsx`: list real persisted packages by status.
- `frontend/src/mediamind/pages/Acervo.jsx`: list/preview real Assets without demo fallback.
- `frontend/src/mediamind/pages/Workspace2.jsx`: real assets plus corrected Step 3 → Step 4 flow.
- colocated `*.test.jsx`/`*.test.js` files: component and pure-operation verification.

---

### Task 1: Freeze the Current Contract and Inventory Enabled Buttons

**Files:**
- Create: `docs/EDITOR_FUNCTIONAL_AUDIT.md`
- Modify: `docs/AI_EDITA_INVENTARIO_E_MATRIZ.md`
- Test: existing frontend/backend suites

**Interfaces:**
- Consumes: current routes, Timeline 2 UI, AI Edita source/browser audit.
- Produces: a table with `screen`, `control`, `current behavior`, `required operation`, `verification`, and `status` used by Tasks 2–11.

- [ ] **Step 1: Run the existing baseline and record exact results**

Run: `python -m pytest -q` and `npm test -- --run` from their documented product directories, then `npm run lint`, `npm run typecheck`, and `npm run build`.

Expected: preserve the actual baseline; do not claim green for any failing gate.

- [ ] **Step 2: Write the functional audit**

Inventory every enabled button in Timeline 2, Workspace 2 Step 3/4, Ingest, Acervo and Edição. Mark notification-only handlers, mock data, `blob:` persistence, missing proxy, broken playhead, drag and layering.

- [ ] **Step 3: Add acceptance identifiers to the comparison matrix**

Use stable IDs `MEDIA-*`, `PLAYER-*`, `EDIT-*`, `INGEST-*`, `EXPORT-*` so implementation and manual QA reference the same requirement.

- [ ] **Step 4: Commit the documentation-only baseline**

```bash
git add docs/EDITOR_FUNCTIONAL_AUDIT.md docs/AI_EDITA_INVENTARIO_E_MATRIZ.md
git commit -m "docs: audit functional editor controls"
```

### Task 2: Tenant-Safe Real Asset Upload and Local Storage

**Files:**
- Create: `backend/app/media/__init__.py`
- Create: `backend/app/media/storage.py`
- Create: `backend/app/media/assets.py`
- Create: `backend/app/api/v1/media.py`
- Create: `backend/tests/test_media_api.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/api/v1/__init__.py`
- Modify: `backend/app/api/v1/uploads.py`

**Interfaces:**
- Consumes: authenticated `CurrentSession`, `assets.write`, `TenantRecord`.
- Produces: `LocalMediaStorage(root: Path)`, `save_original(tenant_id: UUID, asset_id: UUID, upload: UploadFile, max_bytes: int) -> StoredMedia`; `POST /api/v1/media/assets`; `GET /api/v1/media/assets`; compatibility `POST /api/v1/uploads` returning the same Asset payload.

- [ ] **Step 1: Write failing upload/storage tests**

Add tests named `test_media_upload_creates_tenant_asset_and_atomic_original`, `test_media_upload_rejects_oversize_without_orphan`, `test_media_upload_rejects_invalid_suffix_and_mime`, and `test_media_list_is_tenant_scoped`. Assert the response includes `id`, `filename`, `asset_type`, `mime_type`, `file_size`, `sha256`, `media_status`, and `stream_url` but no physical path.

- [ ] **Step 2: Run the focused tests to prove RED**

Run: `python -m pytest backend/tests/test_media_api.py -q`

Expected: FAIL because `/api/v1/media/assets` and `LocalMediaStorage` do not exist.

- [ ] **Step 3: Implement the storage adapter and Asset serializer**

Add `StoredMedia(relative_key: str, size: int, sha256: str, mime_type: str)` and atomic `.part` → final promotion below `<root>/<tenant>/<asset>/original/`. Sanitize metadata filenames and never derive a physical path from user input.

- [ ] **Step 4: Implement the upload/list endpoints and legacy delegation**

Create the Asset record only after final promotion succeeds. On database failure, remove the promoted file. Return `media_status='uploaded'` pending probe. Keep `/uploads` compatible by delegating rather than maintaining a second storage path.

- [ ] **Step 5: Run focused backend checks**

Run: `python -m pytest backend/tests/test_media_api.py backend/tests/test_records_api.py -q`

Expected: PASS.

- [ ] **Step 6: Commit the upload vertical slice**

```bash
git add backend/app/media backend/app/api/v1/media.py backend/app/api/v1/uploads.py backend/app/api/v1/__init__.py backend/app/core/config.py backend/tests/test_media_api.py backend/tests/test_records_api.py
git commit -m "feat: persist tenant media uploads"
```

### Task 3: Real Metadata, Browser Proxy and Range Streaming

**Files:**
- Create: `backend/app/media/probe.py`
- Create: `backend/tests/test_media_probe.py`
- Modify: `backend/app/api/v1/media.py`
- Modify: `backend/app/media/assets.py`
- Modify: `backend/app/core/config.py`
- Test: `backend/tests/test_media_api.py`

**Interfaces:**
- Consumes: `StoredMedia` from Task 2 and configured `media_ffmpeg_path`/`media_ffprobe_path`.
- Produces: `probe_media(path: Path, ffprobe: Path) -> MediaMetadata`; `ensure_edit_proxy(source: Path, destination: Path, ffmpeg: Path) -> ProxyResult`; `GET /api/v1/media/assets/{asset_id}/stream?variant=original|proxy` with byte ranges.

- [ ] **Step 1: Write failing probe, missing-tool and Range tests**

Assert WAV metadata is real; missing FFprobe yields `probe_failed` with a safe diagnostic; a `Range: bytes=1-3` request returns `206`, exact bytes, `Content-Range`, `Accept-Ranges`, correct MIME; cross-tenant and invalid variant return 404/422.

- [ ] **Step 2: Run focused tests to prove RED**

Run: `python -m pytest backend/tests/test_media_probe.py backend/tests/test_media_api.py -q`

Expected: FAIL on missing functions/routes.

- [ ] **Step 3: Implement configurable process execution**

Use argument arrays with `shell=False`, bounded timeout and sanitized errors. In local configuration, allow an explicit path to the available FFmpeg/FFprobe binaries; do not commit the binaries or an absolute user path.

- [ ] **Step 4: Implement metadata/proxy state transitions**

Persist `duration`, `width`, `height`, `fps`, `audio_channels`, `codec`, `proxy_status`, `thumbnail_status`. Browser-safe MP4/WebM/audio may use the original; incompatible video queues or synchronously creates a local H.264/AAC proxy for this first slice.

- [ ] **Step 5: Implement streaming with byte-range semantics**

Expose only tenant-authorized variants. Support full `200`, single-range `206`, invalid range `416`, HEAD-compatible headers and stream chunks without loading the whole file.

- [ ] **Step 6: Run focused and security regression tests**

Run: `python -m pytest backend/tests/test_media_probe.py backend/tests/test_media_api.py backend/tests/test_tenancy.py -q`

Expected: PASS.

- [ ] **Step 7: Commit media processing and streaming**

```bash
git add backend/app/media/probe.py backend/app/media/assets.py backend/app/api/v1/media.py backend/app/core/config.py backend/tests/test_media_probe.py backend/tests/test_media_api.py
git commit -m "feat: stream and probe local media"
```

### Task 4: Real Acervo and Ingest Convergence

**Files:**
- Create: `frontend/src/api/media.js`
- Create: `frontend/src/mediamind/hooks/useMediaAssets.js`
- Create: `frontend/src/mediamind/hooks/useMediaAssets.test.jsx`
- Modify: `frontend/src/mediamind/pages/Acervo.jsx`
- Modify: `frontend/src/mediamind/components/IngestNewPackage.jsx`
- Modify: `frontend/src/mediamind/components/IngestList.jsx`
- Modify: `backend/app/api/v1/records.py`
- Modify: `backend/app/tenancy/record_policies.py`
- Test: `frontend/src/mediamind/pages/Acervo.test.jsx`
- Test: `frontend/src/mediamind/components/IngestNewPackage.test.jsx`

**Interfaces:**
- Consumes: Task 2/3 media endpoints.
- Produces: `listAssets()`, `uploadAsset(file, onProgress?)`, `getAsset(id)`, `mediaStreamUrl(asset, variant)`; hook `{ assets, uploading, error, refresh, uploadFiles }`; persisted `IngestPackage` records.

- [ ] **Step 1: Write failing hook and UI tests**

Assert upload progress, uploaded item immediately appears in Acervo, backend error is visible/retryable, Ingest persists package/file Asset IDs, and Acervo never falls back to `DEMO_ASSETS`.

- [ ] **Step 2: Run focused frontend tests to prove RED**

Run: `npm test -- --run src/mediamind/hooks/useMediaAssets.test.jsx src/mediamind/pages/Acervo.test.jsx src/mediamind/components/IngestNewPackage.test.jsx`

Expected: FAIL because the API/hook and real package behavior do not exist.

- [ ] **Step 3: Add `IngestPackage` to the explicit record policy**

Map `IngestPackage` to `assets.write`; update the coverage test asserting every mutable type has a policy.

- [ ] **Step 4: Implement real asset API/hook and Acervo states**

Render loading, empty, error/retry and real assets. The preview action must open the shared player from Task 6 once available; until then use the authenticated stream URL in a native player, not a fictitious path.

- [ ] **Step 5: Implement persisted Ingest packages**

Upload each file through the shared endpoint, persist file Asset IDs/checksums/statuses, and show the same package after navigation/reload in progress/completed/failure filters.

- [ ] **Step 6: Run frontend/backend focused tests**

Run: the tests from Steps 2 plus `python -m pytest backend/tests/test_records_api.py -q`.

Expected: PASS.

- [ ] **Step 7: Commit Acervo/Ingest convergence**

```bash
git add frontend/src/api/media.js frontend/src/mediamind/hooks/useMediaAssets* frontend/src/mediamind/pages/Acervo* frontend/src/mediamind/components/IngestNewPackage* frontend/src/mediamind/components/IngestList* backend/app/api/v1/records.py backend/app/tenancy/record_policies.py backend/tests/test_records_api.py
git commit -m "feat: connect ingest and acervo to real media"
```

### Task 5: Persisted Versioned Editor Projects

**Files:**
- Create: `frontend/src/mediamind/lib/editorDocument.js`
- Create: `frontend/src/mediamind/lib/editorDocument.test.js`
- Create: `frontend/src/mediamind/hooks/useEditorProject.js`
- Create: `frontend/src/mediamind/hooks/useEditorProject.test.jsx`
- Modify: `backend/app/api/v1/media.py`
- Test: `backend/tests/test_media_api.py`

**Interfaces:**
- Consumes: Asset IDs and URLs from Tasks 2–4.
- Produces: `normalizeEditorDocument(input) -> EditorDocument`; `workspaceToEditorDocument(input) -> EditorDocument`; `GET/PUT /api/v1/media/projects/{project_id}` with `revision`; hook `{ document, commit, undo, redo, saveNow, saveState, conflict, reload }`.

- [ ] **Step 1: Write failing schema/conversion/persistence tests**

Assert invalid/clamped values normalize safely; Workspace conversion preserves selected media order and blocks; two saves with stale revision produce `409`; reload restores clips/properties and Asset references.

- [ ] **Step 2: Run tests to prove RED**

Run: `npm test -- --run src/mediamind/lib/editorDocument.test.js src/mediamind/hooks/useEditorProject.test.jsx` and `python -m pytest backend/tests/test_media_api.py -q`.

- [ ] **Step 3: Implement pure document schema and migration from Timeline 2 documents**

Set `schemaVersion: 1`, stable IDs, FPS-aware minimum duration and canonical seconds. Preserve unknown future fields only in an `extensions` object.

- [ ] **Step 4: Implement tenant project endpoints with optimistic revision**

Store the document in a `ProducaoProjeto` record. A PUT consumes `{ revision, document }` and returns `{ revision: revision + 1, document, updated_date }`; stale revision returns `409 EDITOR_REVISION_CONFLICT`.

- [ ] **Step 5: Implement debounced autosave and recovery hook**

Keep undo/redo local, debounce confirmed saves, expose conflict without overwriting the server, flush on explicit Save, and retain a local recovery copy only as fallback.

- [ ] **Step 6: Run focused tests and commit**

Expected: all Step 2 tests PASS.

```bash
git add frontend/src/mediamind/lib/editorDocument* frontend/src/mediamind/hooks/useEditorProject* backend/app/api/v1/media.py backend/tests/test_media_api.py
git commit -m "feat: persist versioned editor projects"
```

### Task 6: Shared Functional Player and Timeline Synchronization

**Files:**
- Create: `frontend/src/mediamind/components/editor/MediaPlayer.jsx`
- Create: `frontend/src/mediamind/components/editor/MediaPlayer.test.jsx`
- Create: `frontend/src/mediamind/lib/playbackEngine.js`
- Create: `frontend/src/mediamind/lib/playbackEngine.test.js`
- Modify: `frontend/src/mediamind/pages/Acervo.jsx`
- Modify: `frontend/src/mediamind/pages/Timeline2.jsx`

**Interfaces:**
- Consumes: `EditorDocument`, Asset stream URLs and selected/visible clips.
- Produces: `resolveActiveLayers(document, time) -> ActiveLayer[]`; `<MediaPlayer document playhead playing onTimeChange onPlayingChange />`.

- [ ] **Step 1: Write failing layer/playback tests**

Assert active clips honor `sourceIn`, speed, trim, hidden/muted tracks and layer order; `timeupdate` updates playhead; external playhead seek updates media `currentTime`; play rejection/error is shown and does not freeze controls.

- [ ] **Step 2: Run focused tests to prove RED**

Run: `npm test -- --run src/mediamind/lib/playbackEngine.test.js src/mediamind/components/editor/MediaPlayer.test.jsx`

Expected: FAIL on missing modules.

- [ ] **Step 3: Implement the playback engine**

Resolve active visual/audio layers as pure data. Keep one clock authority while playing and guard feedback loops when syncing program time to source time.

- [ ] **Step 4: Implement the shared player**

Render overlapping video/image/text layers with deterministic z-order and transformations. Render audible tracks, propagate play/pause/seek/rate/volume, and expose loading/proxy/error states.

- [ ] **Step 5: Replace page-local/native placeholder players**

Use the shared player in Timeline 2 and Acervo preview. Preserve any existing useful controls; remove fake “reference without proxy” behavior once a real stream/proxy exists.

- [ ] **Step 6: Run focused tests and commit**

Expected: Step 2 tests and Acervo/Timeline component tests PASS.

```bash
git add frontend/src/mediamind/components/editor/MediaPlayer* frontend/src/mediamind/lib/playbackEngine* frontend/src/mediamind/pages/Acervo* frontend/src/mediamind/pages/Timeline2*
git commit -m "feat: add synchronized layered media player"
```

### Task 7: Reliable Playhead, Drag, Trim and Layer Movement

**Files:**
- Create: `frontend/src/mediamind/components/editor/TimelineCanvas.jsx`
- Create: `frontend/src/mediamind/components/editor/TimelineCanvas.test.jsx`
- Modify: `frontend/src/mediamind/lib/editorDocument.js`
- Modify: `frontend/src/mediamind/lib/editorDocument.test.js`
- Modify: `frontend/src/mediamind/pages/Timeline2.jsx`

**Interfaces:**
- Consumes: Task 5 commands and `document.zoom`/scroll container geometry.
- Produces: `pointerToTimelineTime({ clientX, rect, scrollLeft, pixelsPerSecond, duration }) -> number`; pointer-captured playhead/clip/trim interactions; functional cross-compatible-track movement.

- [ ] **Step 1: Write failing pointer and command tests**

Assert pointer mapping at zoom 0.25/1/8 with nonzero scroll; dragging playhead works from ruler and track body; clip drag updates time/track; incompatible/locked target does not mutate; left/right trim enforces one frame; snapping can be toggled.

- [ ] **Step 2: Run focused tests to prove RED**

Run: `npm test -- --run src/mediamind/components/editor/TimelineCanvas.test.jsx src/mediamind/lib/editorDocument.test.js`

Expected: FAIL on missing canvas/interactions.

- [ ] **Step 3: Implement pure movement/trim/split/ripple commands**

Port verified behavior from `timeline2Model.js` into the versioned document and add stable multi-track compatibility. Do not use `Date.now()` for IDs in deterministic command tests; inject/create IDs at command boundary.

- [ ] **Step 4: Implement pointer-captured interactions**

Use Pointer Events and `setPointerCapture`; calculate time from scroll plus scale; prevent overlay panels/clip children from swallowing playhead actions; update continuously and commit one undo state per completed gesture.

- [ ] **Step 5: Implement drag from Acervo/project library**

Use an explicit drag payload containing Asset ID, kind and duration; reload full metadata from state/API rather than trusting arbitrary JSON from `dataTransfer`.

- [ ] **Step 6: Run focused tests and commit**

Expected: Step 2 tests PASS.

```bash
git add frontend/src/mediamind/components/editor/TimelineCanvas* frontend/src/mediamind/lib/editorDocument* frontend/src/mediamind/pages/Timeline2*
git commit -m "feat: make timeline pointer editing reliable"
```

### Task 8: Functional Toolbar, Properties and Keyboard Commands

**Files:**
- Create: `frontend/src/mediamind/components/editor/EditorToolbar.jsx`
- Create: `frontend/src/mediamind/components/editor/EditorToolbar.test.jsx`
- Create: `frontend/src/mediamind/components/editor/EditorInspector.jsx`
- Create: `frontend/src/mediamind/components/editor/EditorInspector.test.jsx`
- Modify: `frontend/src/mediamind/lib/editorDocument.js`
- Modify: `frontend/src/mediamind/pages/Timeline2.jsx`
- Test: `frontend/src/mediamind/pages/Timeline2.test.jsx`

**Interfaces:**
- Consumes: Task 5/7 `commit(command)` and selection.
- Produces: commands for split, split-left/right, delete, duplicate, extract-audio metadata, ripple, snapping, markers, undo/redo, transform, opacity, volume, speed, text and track state.

- [ ] **Step 1: Write failing control-to-command tests**

For every enabled toolbar/sidebar/inspector button, assert the document changes or a real request starts. Assert no enabled button only changes `notice`. Assert unavailable freeze-frame/effect/keyframe actions are disabled with an explanation.

- [ ] **Step 2: Run focused tests to prove RED**

Run: `npm test -- --run src/mediamind/components/editor/EditorToolbar.test.jsx src/mediamind/components/editor/EditorInspector.test.jsx src/mediamind/pages/Timeline2.test.jsx`

Expected: FAIL for decorative controls.

- [ ] **Step 3: Implement toolbar command dispatch**

Use stable command IDs and disable actions with no valid selection. Keyboard shortcuts call the same dispatch functions as buttons; they must not fire while editing inputs.

- [ ] **Step 4: Implement real inspector updates**

Persist X/Y, scale X/Y/link, rotation, opacity, volume, speed and text fields. Apply changes immediately in the shared player and save through the project hook.

- [ ] **Step 5: Split Timeline 2 into focused components**

Leave `Timeline2.jsx` responsible for loading project/assets, selection and layout only. Remove `MOCK_ASSETS`, session-only upload state and duplicated playback code.

- [ ] **Step 6: Run focused tests and commit**

Expected: all Step 2 tests PASS and the functional audit has no unexplained enabled control in this slice.

```bash
git add frontend/src/mediamind/components/editor frontend/src/mediamind/lib/editorDocument* frontend/src/mediamind/pages/Timeline2*
git commit -m "feat: connect editor controls to real commands"
```

### Task 9: Workspace 2 Step 3 to Mounted Step 4

**Files:**
- Modify: `frontend/src/mediamind/pages/Workspace2.jsx`
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Stepper.jsx`
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Timeline.jsx`
- Modify: `frontend/src/mediamind/pages/Workspace2.test.jsx`

**Interfaces:**
- Consumes: real assets from Task 4, `workspaceToEditorDocument` and editor composition from Tasks 5–8.
- Produces: preserved Step 3 with final-column readiness summary and Step 4 containing the mounted editor for the same persisted project.

- [ ] **Step 1: Write failing regression/flow tests**

Assert every existing Step 3 preview control remains; readiness summary is in the last column; click opens Step 4 directly; selected assets/order/blocks/tracks are mounted once; reload resumes the same project; no intermediate readiness page remains.

- [ ] **Step 2: Run tests to prove RED**

Run: `npm test -- --run src/mediamind/pages/Workspace2.test.jsx`

Expected: FAIL because Step 4 is currently the readiness card and assets are mock-based.

- [ ] **Step 3: Replace Workspace mock assets with real assets**

Preserve selection and preview behavior using Asset IDs. Upload from Workspace uses Task 4 and immediately joins selection/Acervo.

- [ ] **Step 4: Move readiness content into Step 3 and mount editor in Step 4**

Conversion must be idempotent: create the initial document only when the project has no editor document; otherwise open the saved revision.

- [ ] **Step 5: Run tests and commit**

Expected: Workspace and Timeline suites PASS.

```bash
git add frontend/src/mediamind/pages/Workspace2* frontend/src/mediamind/components/workspace2
git commit -m "feat: open mounted editor from workspace step four"
```

### Task 10: Real Local Export and Derived Asset

**Files:**
- Create: `backend/app/media/render.py`
- Create: `backend/tests/test_media_render.py`
- Modify: `backend/app/api/v1/media.py`
- Modify: `frontend/src/api/media.js`
- Modify: `frontend/src/mediamind/pages/Timeline2.jsx`
- Test: `frontend/src/mediamind/pages/Timeline2.test.jsx`

**Interfaces:**
- Consumes: persisted EditorDocument and original/proxy files.
- Produces: `build_ffmpeg_render(document, asset_paths, output_path) -> list[str]`; `POST /api/v1/media/projects/{id}/exports`; `GET /api/v1/media/exports/{job_id}`; derived Asset on success.

- [ ] **Step 1: Write failing render/idempotency tests**

Assert ordered trimmed clips create deterministic arguments; transforms/opacity/speed/volume/text supported by this slice enter the filter graph; missing source fails visibly; same idempotency key returns the same job/result; output Asset references project/revision/original inputs.

- [ ] **Step 2: Run tests to prove RED**

Run: `python -m pytest backend/tests/test_media_render.py backend/tests/test_media_api.py -q`

Expected: FAIL on missing renderer/export routes.

- [ ] **Step 3: Implement the supported FFmpeg render translator**

Support the verified subset exposed as enabled: trim, sequential/overlapping layers, position/scale/rotation/opacity, playback speed, volume, mute and text. Reject unsupported commands before starting; never silently omit an enabled property.

- [ ] **Step 4: Implement local export job lifecycle**

Persist a `ProcessamentoJob` with `queued/running/completed/failed`, sanitized progress/error and idempotency key. For this local slice, use a bounded background executor; write to `.part` then atomically promote and create derived Asset.

- [ ] **Step 5: Connect Export UI to the real job**

Show preset, start confirmation, progress, cancel availability, failure/retry and result link. Do not show success until the derived Asset stream exists.

- [ ] **Step 6: Run backend/frontend focused tests and commit**

Expected: render tests and Timeline export tests PASS.

```bash
git add backend/app/media/render.py backend/app/api/v1/media.py backend/tests/test_media_render.py backend/tests/test_media_api.py frontend/src/api/media.js frontend/src/mediamind/pages/Timeline2*
git commit -m "feat: export editor projects to derived media"
```

### Task 11: End-to-End Local Proof, Mock Removal and Documentation

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: all operational files still importing relevant mock asset/ingest/editor data
- Modify: `docs/EDITOR_FUNCTIONAL_AUDIT.md`
- Modify: `docs/AI_EDITA_INVENTARIO_E_MATRIZ.md`
- Modify: `docs/MAPA_DO_PROJETO.md`
- Modify: `docs/RELATORIO_REESTRUTURACAO.md`
- Modify: `docs/CODEX_HANDOFF.md`
- Create: `docs/runbooks/LOCAL_MEDIA_EDITOR_TEST.md`

**Interfaces:**
- Consumes: Tasks 2–10.
- Produces: reproducible local test instructions and evidence for the complete non-AI journey.

- [ ] **Step 1: Add a no-operational-mocks guard test**

Scan designated operational entry points and fail if they import `MOCK_ASSETS`, `MOCK_INGEST_PACKAGES`, `withDemoFallback` or create durable media via `URL.createObjectURL`. Exempt test fixtures explicitly.

- [ ] **Step 2: Execute the real-media journey manually in the side browser**

Choose at least one video and one audio file; confirm Acervo persistence; open Workspace 2; preview; enter mounted Step 4; add both to tracks; drag playhead; move/trim/split/duplicate/delete/undo; change layer/property; save; reload; export; play the derived result from Acervo.

- [ ] **Step 3: Restart frontend/backend and repeat persistence checks**

Expected: assets, ingest package, project revision and exported derived Asset remain available; no session `blob:` is required.

- [ ] **Step 4: Run complete automated gates**

Run: `python -m pytest -q`, backend coverage gate, `npm test -- --run`, `npm run lint`, `npm run typecheck`, and `npm run build`.

Expected: all current gates pass; any environment-only FFmpeg test is separately identified, never hidden.

- [ ] **Step 5: Update audit, matrix, reports and rollback**

Mark each ID with evidence: implemented/verified, disabled, or blocked. Document how to stop jobs, preserve `.runtime/media`, restore the previous frontend route behavior and revert each commit without deleting user media.

- [ ] **Step 6: Commit the verified vertical slice documentation**

```bash
git add frontend/src docs/EDITOR_FUNCTIONAL_AUDIT.md docs/AI_EDITA_INVENTARIO_E_MATRIZ.md docs/MAPA_DO_PROJETO.md docs/RELATORIO_REESTRUTURACAO.md docs/CODEX_HANDOFF.md docs/runbooks/LOCAL_MEDIA_EDITOR_TEST.md
git commit -m "docs: verify real media editor journey"
```

## Deferred to Follow-On Plans, Not Simulated

- AI-assisted edit/transcription when providers are unavailable.
- Full caption style-pack conversion and word-level animation.
- Advanced masks, effect graph, transition library, keyframe curve editor and GPU renderer.
- Batch queue, publication, Insights and company/Central configuration.

Their buttons must remain disabled or clearly marked until their dedicated plans provide real contracts. The vertical slice above must remain fully functional without them.

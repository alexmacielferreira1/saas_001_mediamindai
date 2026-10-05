# Real Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first high-risk MediaMind panels distinguish real, empty, unavailable, unauthorized, and explicit demo data without deleting existing behavior or silently substituting mocks.

**Architecture:** Add a small frontend data-origin contract, centralize the minimal demo catalog, and migrate Home, Administration, and AI monitoring to explicit source states. The backend gains a read-only AI status endpoint; no provider secrets or external activation are introduced. A checked-in inventory records later screens without pulling their implementation into this plan.

**Tech Stack:** React 18, Vitest, Testing Library, FastAPI, SQLAlchemy test fixtures, Pytest

**Spec:** `docs/superpowers/specs/2026-10-05-real-data-and-minimal-demo-design.md`

## Global Constraints

- Preserve layout, navigation, real records, legacy files, ZIPs, Word sources, and Base44 references.
- Demo data uses the logical catalog name `demo_seed_v1` and remains restricted to explicit local/test demo flows.
- An authenticated API failure must never produce plausible demo data.
- Demo records must not contribute to real totals, costs, health, alerts, or audit indicators.
- Central never receives MediaMind secrets or direct database access.
- No deploy, Neon migration, Render change, provider activation, push, or production action is authorized by this plan.
- Use small commits and stage only files named by the active task; preserve unrelated working-tree changes.

## Review Focus

- A `401` or `403` must render a permission/session state, not an empty collection or demo fixture; covered in Tasks 2, 4, and 5.
- A successful empty response must remain `VAZIO`, distinct from network failure; covered in Tasks 2 and 4.
- An API timeout or `503` must render `INDISPONÍVEL` and retain no previous demo totals; covered in Tasks 2, 4, and 5.
- Demo catalog initialization must be idempotent and impossible outside explicit local demo context; covered in Task 3.
- `AI_PROVIDER_NOT_CONFIGURED` must render `NÃO CONFIGURADO`, while `CONECTADO` requires a real status response; covered in Task 5.

---

### Task 1: Canonical screen and data-source inventory

**Files:**
- Create: `docs/REAL_DATA_SCREEN_INVENTORY.md`
- Reference: `docs/LEGACY_FINDINGS_REVIEW.md`
- Reference: `docs/ADMINISTRATION_VISUAL_POLISH_2026-10-04.md`

**Interfaces:**
- Consumes: current routes, components, API adapters, demo helpers, and the four source states from the spec.
- Produces: a Markdown table with `route`, `component`, `current_source`, `expected_source`, `reads`, `writes`, `empty`, `error`, `permission`, `demo`, `tests`, and `state` columns.

- [ ] **Step 1: Enumerate active MediaMind routes and their page components**

Run: `rg -n "path=|createBrowserRouter|<Route" frontend/src`

Expected: every active MediaMind route has one inventory row or an explicit note that it is infrastructure-only.

- [ ] **Step 2: Trace data entry points for each active page**

Run: `rg -n -i "mock|demo|fallback|localStorage|base44|getMyDashboard|request\(" frontend/src/mediamind frontend/src/api`

Expected: each row names the current source and whether writes are real, local, unavailable, or mixed.

- [ ] **Step 3: Write the inventory and prioritize the first migration set**

Set Home, Administration, Acervo monitoring, and AI status to `EM_EXECUCAO`; later areas remain `PENDENTE` or `BLOQUEADO` with a concrete reason. Do not claim a screen is real based only on visible content.

- [ ] **Step 4: Verify inventory completeness**

Run: `rg -n "\| /(home|administration|acervo|ingest|workspace)" docs/REAL_DATA_SCREEN_INVENTORY.md`

Expected: the high-risk routes appear with source, fallback, and test information.

- [ ] **Step 5: Commit**

```powershell
git add -- docs/REAL_DATA_SCREEN_INVENTORY.md
git commit -m "docs: inventory MediaMind data sources"
```

### Task 2: Shared frontend data-origin contract

**Files:**
- Create: `frontend/src/mediamind/lib/dataOrigin.js`
- Create: `frontend/src/mediamind/lib/dataOrigin.test.js`

**Interfaces:**
- Produces: `DATA_SOURCE`, `realData(data, generatedAt)`, `emptyData(data, generatedAt)`, `unavailableData(error)`, `forbiddenData(error)`, `demoData(data, dataset)`, and `classifyRequestError(error)`.
- Envelope: `{ data, source, generated_at, error, demo_dataset }`.

- [ ] **Step 1: Write failing unit tests for the five source outcomes**

Tests assert that real and empty retain `generated_at`, demo always contains `demo_seed_v1`, unavailable contains no synthetic data, and status `401|403` classifies as forbidden rather than empty.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm --prefix frontend test -- --run src/mediamind/lib/dataOrigin.test.js`

Expected: FAIL because `dataOrigin.js` does not exist.

- [ ] **Step 3: Implement the minimal immutable constructors and error classifier**

Do not add state management or React dependencies. Accept only the exact source strings `REAL`, `VAZIO`, `INDISPONIVEL`, `SEM_PERMISSAO`, and `DEMONSTRACAO`.

- [ ] **Step 4: Run focused tests**

Run: `npm --prefix frontend test -- --run src/mediamind/lib/dataOrigin.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- frontend/src/mediamind/lib/dataOrigin.js frontend/src/mediamind/lib/dataOrigin.test.js
git commit -m "feat: add explicit frontend data origins"
```

### Task 3: Minimal reusable demo catalog

**Files:**
- Create: `frontend/src/mediamind/lib/demoCatalog.js`
- Create: `frontend/src/mediamind/lib/demoCatalog.test.js`
- Modify: `frontend/src/mediamind/pages/Administration2.jsx`
- Modify: `frontend/src/mediamind/components/admin2/UsersForms2.jsx`

**Interfaces:**
- Consumes: explicit local demo session from `demoAccess.js`.
- Produces: `DEMO_DATASET = 'demo_seed_v1'`, `getDemoUsers()`, `getDemoPermissionGroups()`, and `isDemoRecord(record)`; returned records carry `is_demo: true` and `demo_dataset`.

- [ ] **Step 1: Write failing catalog tests**

Assert stable IDs, the shared dataset marker, defensive copies, no duplicate IDs, and the smallest reusable user/group set required by Administration.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm --prefix frontend test -- --run src/mediamind/lib/demoCatalog.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the catalog and replace duplicated Administration constants**

Keep existing visible examples where needed, but source them from one catalog. Do not migrate unrelated Corp or Workspace fixtures in this task.

- [ ] **Step 4: Prove the catalog cannot affect normal authenticated responses**

Add assertions to `Administration2.test.jsx` that demo IDs render only when the explicit local demo session is active.

- [ ] **Step 5: Run catalog and Administration tests**

Run: `npm --prefix frontend test -- --run src/mediamind/lib/demoCatalog.test.js src/mediamind/pages/Administration2.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- frontend/src/mediamind/lib/demoCatalog.js frontend/src/mediamind/lib/demoCatalog.test.js frontend/src/mediamind/pages/Administration2.jsx frontend/src/mediamind/components/admin2/UsersForms2.jsx frontend/src/mediamind/pages/Administration2.test.jsx
git commit -m "refactor: centralize minimal administration demo data"
```

### Task 4: Remove silent Home and Administration fallbacks

**Files:**
- Modify: `frontend/src/mediamind/pages/Home.jsx`
- Modify: `frontend/src/mediamind/pages/Home.test.jsx`
- Modify: `frontend/src/mediamind/pages/Administration2.jsx`
- Modify: `frontend/src/mediamind/pages/Administration2.test.jsx`

**Interfaces:**
- Consumes: Task 2 envelope constructors and Task 3 demo catalog.
- Produces: explicit source banners and mutually exclusive real, empty, unavailable, forbidden, and demo rendering.

- [ ] **Step 1: Write failing Home tests**

Cover successful KPIs as real, empty API response as empty, request rejection as unavailable with no fallback counts, and explicit demo session as labeled demo.

- [ ] **Step 2: Write failing Administration tests**

Cover `401|403`, empty users, network failure, real payload, and explicit demo session. Assert that network failure never renders `demo-1` or a plausible user total.

- [ ] **Step 3: Run focused tests and confirm failures**

Run: `npm --prefix frontend test -- --run src/mediamind/pages/Home.test.jsx src/mediamind/pages/Administration2.test.jsx`

Expected: FAIL on current silent fallback behavior.

- [ ] **Step 4: Migrate Home to explicit source state**

Remove `dashboard?.kpis || fallbackKpis`. Real API data drives real KPIs; explicit demo mode may use catalog-backed preview; errors render an unavailable panel and empty responses render zero/empty state without invented activity.

- [ ] **Step 5: Migrate Administration to explicit source state**

Delete the branch that converts API failure into demo users. Keep demo rendering only behind `readLocalDemoSession()`. Preserve currently functional backend mutations and disable them in demo/unavailable/forbidden states.

- [ ] **Step 6: Run focused tests**

Run: `npm --prefix frontend test -- --run src/mediamind/pages/Home.test.jsx src/mediamind/pages/Administration2.test.jsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- frontend/src/mediamind/pages/Home.jsx frontend/src/mediamind/pages/Home.test.jsx frontend/src/mediamind/pages/Administration2.jsx frontend/src/mediamind/pages/Administration2.test.jsx
git commit -m "fix: stop authenticated screens from masking API failures"
```

### Task 5: Honest AI provider status and Acervo monitoring

**Files:**
- Modify: `backend/app/api/v1/ai.py`
- Modify: `backend/tests/test_ai_api.py`
- Create: `frontend/src/api/ai.js`
- Create: `frontend/src/api/ai.test.js`
- Modify: `frontend/src/mediamind/pages/Acervo.jsx`
- Create: `frontend/src/mediamind/pages/Acervo.test.jsx`

**Interfaces:**
- Backend produces: `GET /api/v1/ai/status -> { state, provider, checked_at, capabilities }` where the initial real state is `NOT_CONFIGURED`, provider is `null`, and capabilities are empty.
- Frontend produces: `getAiStatus()` and an explicit status envelope consumed by `MonitoringTab`.

- [ ] **Step 1: Write failing backend status tests**

Test unauthenticated `401`; authenticated initial response `200` with `state == 'NOT_CONFIGURED'`, `provider is None`, `capabilities == []`, and a nonempty `checked_at`. Do not report connected without a provider check.

- [ ] **Step 2: Run backend tests and confirm failure**

Run: `python -m pytest backend/tests/test_ai_api.py -q`

Expected: FAIL because `/ai/status` does not exist.

- [ ] **Step 3: Implement the read-only backend status endpoint**

Use the existing authenticated membership dependency. Do not add database tables, credentials, provider probing, or external calls.

- [ ] **Step 4: Run backend tests**

Run: `python -m pytest backend/tests/test_ai_api.py -q`

Expected: PASS.

- [ ] **Step 5: Write failing frontend adapter and Acervo tests**

Assert request path `/ai/status`; `NOT_CONFIGURED` renders “Não configurado”; request failure renders unavailable; explicit demo is labeled; static “OK” model cards do not render as real status.

- [ ] **Step 6: Implement adapter and migrate `MonitoringTab`**

Preserve the panel layout. Replace static AI health claims with the real status response and explicit states. No usage or cost values are invented.

- [ ] **Step 7: Run frontend tests**

Run: `npm --prefix frontend test -- --run src/api/ai.test.js src/mediamind/pages/Acervo.test.jsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add -- backend/app/api/v1/ai.py backend/tests/test_ai_api.py frontend/src/api/ai.js frontend/src/api/ai.test.js frontend/src/mediamind/pages/Acervo.jsx frontend/src/mediamind/pages/Acervo.test.jsx
git commit -m "feat: expose honest AI configuration status"
```

### Task 6: Regression, inventory update, and handoff

**Files:**
- Modify: `docs/REAL_DATA_SCREEN_INVENTORY.md`
- Create: `docs/REAL_DATA_FOUNDATION_RESULT.md`

**Interfaces:**
- Consumes: all completed tasks and their test evidence.
- Produces: updated states for the first migration set, commands/results, known blocks, rollback notes, and the next plan boundary.

- [ ] **Step 1: Run the complete backend suite**

Run: `python -m pytest backend/tests -q`

Expected: PASS with no new failures.

- [ ] **Step 2: Run the complete frontend quality gate**

Run: `npm --prefix frontend test -- --run`

Expected: PASS.

Run: `npm --prefix frontend run lint`

Expected: exit code 0.

Run: `npm --prefix frontend run typecheck`

Expected: exit code 0.

Run: `npm --prefix frontend run build`

Expected: exit code 0.

- [ ] **Step 3: Perform a local browser smoke check**

Check Home, Administration, and Acervo monitoring in normal authenticated and explicit local demo modes. Verify no API failure produces demo users, counts, provider health, or costs.

- [ ] **Step 4: Update the inventory from evidence**

Mark a row `CONCLUIDO` only if its source states and tests pass. Record remaining screens as the input to the next plan; do not claim ZIP 2 complete yet.

- [ ] **Step 5: Write the result and rollback document**

List commits, tests, screenshots or observed states, known blocks, and per-task reversal order. State explicitly that production and external providers were untouched.

- [ ] **Step 6: Commit**

```powershell
git add -- docs/REAL_DATA_SCREEN_INVENTORY.md docs/REAL_DATA_FOUNDATION_RESULT.md
git commit -m "docs: record real data foundation results"
```

# Administração 2 Contextual and Visual Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every apparently interactive element in Administração 2 work inside its current context while correcting missing, empty, misplaced, and incorrectly illustrated content against the approved visual references.

**Architecture:** Keep `Administration2` as the route and data coordinator, but allow its entire presentation layer to be substantially rebuilt around the approved photos. Extract reusable master-detail primitives and focused tab sections so selection, accessibility, empty states, and media fallbacks are consistent. Existing APIs remain the only source of persistent data; demo data never triggers mutations. Visual traceability is recorded per tab before implementation and verified with responsive screenshots after each slice.

**Tech Stack:** React 18, React Router, Tailwind CSS, Vitest, Testing Library, Vite, existing MediaMind UI primitives.

**Spec:** `docs/superpowers/specs/2026-10-02-administracao2-detalhes-contextuais-design.md`

## Global Constraints

- Administração 2 is an explicit exception to preserving the existing frontend layout: presentation, hierarchy, density, cards, tables, panels, and contextual navigation may change substantially to match the approved photos.
- The reference photos are the primary source of truth for Administração 2 presentation, hierarchy, and interaction; when current UI and reference conflict, the reference wins within backend, security, permission, accessibility, and real-data constraints.
- Preserve backend contracts, public routes, authentication, tenant isolation, permissions, and working business flows.
- Do not create new backend endpoints or invent metrics, photos, health states, or history.
- Use pages 19–25 of `AJUSTAR SAAS 16092026 (5).pdf` and the 26 references cited in `docs/ADMINISTRATION2_CHECKLIST.md`; do not copy imagery from other HUB products.
- Keep actions without backend support visibly disabled and explain the missing dependency.
- Keep filters, active tab, scroll context, and valid selection when opening or closing details.
- Preserve all pre-existing uncommitted work; stage only files owned by the current task.
- Never expose credentials or secrets to the frontend, tests, documentation, screenshots, or commits.
- Do not modify `Workspace2` or any Roteiro flow inside it; run their existing tests only as regression gates.
- Preserve every working Administration capability; if a reference screen has no suitable placement, retain it in a descriptive contextual subtab whose label ends in `+1`.

## Review Focus

- A filtered item disappears while selected: close or replace its detail predictably without resetting the filter.
- A real API request fails after list data loaded: keep the list visible and show the error only in the detail panel.
- A person or asset has no usable image: render initials or a neutral fallback without broken-image chrome or unrelated photography.
- A narrow viewport opens nested details: maintain focus, provide a clear return action, and restore focus to the originating item.
- Demo mode displays controls that persist real data: prevent all API mutations except the existing local-only settings behavior.

---

### Task 1: Visual Reference Matrix

**Files:**
- Create: `docs/ADMINISTRATION2_VISUAL_AUDIT.md`
- Modify: `docs/ADMINISTRATION2_CHECKLIST.md`

**Interfaces:**
- Consumes: pages 19–25 listed in `_documentacao/SOURCE_INTAKE_2026-09-23_ADMIN_PUBLICACAO_IMPORTACAO.md` and current `/administration2` rendering.
- Produces: one audit row per tab with `reference`, `current`, `classification`, `data source`, `expected interaction`, and `acceptance evidence` fields.

- [ ] **Step 1: Record every Administration 2 reference and map it to its tab and visible blocks**

Each row must classify the difference as `missing`, `legitimate-empty`, `misplaced`, `unproven`, or `matched`.

For every `missing` or `misplaced` row, state whether the current block is retained, rebuilt, merged, moved, or removed. Do not default to retaining the current structure when it conflicts with the photo.

- [ ] **Step 2: Audit photographs, avatars, thumbnails, reserved image areas, and image fallbacks**

Record whether each visual is real data, a neutral fallback, decorative, or unsupported; flag deformation, unrelated imagery, broken URLs, and oversized empty image regions.

- [ ] **Step 3: Add the audit as an active checklist gate**

Add a checklist item requiring all rows to have implementation and responsive evidence before the visual convergence is considered complete.

- [ ] **Step 4: Review the matrix against the spec**

Expected: no row proposes invented data, a cross-product image, or a redirect in place of contextual detail.

- [ ] **Step 5: Commit**

```bash
git add docs/ADMINISTRATION2_VISUAL_AUDIT.md docs/ADMINISTRATION2_CHECKLIST.md
git commit -m "docs(admin): mapear referencias visuais"
```

### Task 2: Reusable Context Detail Primitives

**Files:**
- Create: `frontend/src/mediamind/components/admin2/ContextDetailLayout.jsx`
- Create: `frontend/src/mediamind/components/admin2/ContextDetailLayout.test.jsx`
- Create: `frontend/src/mediamind/components/admin2/MediaIdentity.jsx`
- Create: `frontend/src/mediamind/components/admin2/MediaIdentity.test.jsx`

**Interfaces:**
- Consumes: existing `Button`, `EmptyState`, and `Panel` UI primitives.
- Produces: `ContextDetailLayout({ master, detail, detailTitle, isOpen, onClose, originRef })`, `SelectableItem({ selected, onSelect, children, ...buttonProps })`, `UnavailableAction({ reason, children })`, and `MediaIdentity({ src, alt, initials, kind, className })`.

- [ ] **Step 1: Write failing layout tests**

Test names: `keeps_master_visible_when_detail_fails`, `marks_selected_item_for_assistive_technology`, `restores_focus_when_mobile_detail_closes`, and `disables_unavailable_action_with_visible_reason`.

- [ ] **Step 2: Run the layout tests and verify they fail**

Run: `npm test -- --run src/mediamind/components/admin2/ContextDetailLayout.test.jsx`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the context-detail primitives**

Use semantic buttons, `aria-selected` or `aria-pressed`, an accessible detail heading, and responsive master/detail regions; do not include domain data.

- [ ] **Step 4: Write failing media fallback tests**

Test names: `shows_initials_when_src_is_missing`, `falls_back_after_image_error`, `preserves_informative_alt_text`, and `hides_decorative_image_from_accessibility_tree`.

- [ ] **Step 5: Implement `MediaIdentity` and run both test files**

Run: `npm test -- --run src/mediamind/components/admin2/ContextDetailLayout.test.jsx src/mediamind/components/admin2/MediaIdentity.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/mediamind/components/admin2
git commit -m "feat(admin): criar detalhes contextuais acessiveis"
```

### Task 3: Users, Profiles, Access, and Teams

**Files:**
- Create: `frontend/src/mediamind/components/admin2/PeopleAccessSections.jsx`
- Create: `frontend/src/mediamind/components/admin2/PeopleAccessSections.test.jsx`
- Modify: `frontend/src/mediamind/pages/Administration2.jsx`
- Modify: `frontend/src/mediamind/pages/Administration2.test.jsx`

**Interfaces:**
- Consumes: Task 2 primitives, existing admin API values, permission groups, local demo session behavior, and `AdminAcessosPage`.
- Produces: `UsersSection`, `ProfilesSection`, and `TeamsSection`, each accepting data, selected id, selection callback, loading state, and scoped error; leaves access mutations with `AdminAcessosPage`.

- [ ] **Step 1: Write failing interaction tests for the people and access areas**

Cover row/card selection, same-screen user detail, linked-user subdetail with return, team member subdetail, filter preservation, selected item removed by filtering, and no mutation in demo mode.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- --run src/mediamind/components/admin2/PeopleAccessSections.test.jsx src/mediamind/pages/Administration2.test.jsx`

Expected: FAIL on missing contextual behaviors.

- [ ] **Step 3: Extract and implement the three sections with contextual details**

Keep the current user API contract and suspension confirmation. Render unsupported subsections as explanatory empty states, not links or fake buttons.

- [ ] **Step 4: Apply avatar rules with `MediaIdentity`**

Use a real user image only if the existing payload supplies it; otherwise use initials. Do not introduce stock portraits.

- [ ] **Step 5: Run the focused tests**

Run: `npm test -- --run src/mediamind/components/admin2/PeopleAccessSections.test.jsx src/mediamind/pages/Administration2.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/mediamind/components/admin2/PeopleAccessSections.jsx frontend/src/mediamind/components/admin2/PeopleAccessSections.test.jsx frontend/src/mediamind/pages/Administration2.jsx frontend/src/mediamind/pages/Administration2.test.jsx
git commit -m "feat(admin): detalhar pessoas e acessos no contexto"
```

### Task 4: Forms, Imports, Security, and Registry Hierarchies

**Files:**
- Create: `frontend/src/mediamind/components/admin2/GovernanceSections.jsx`
- Create: `frontend/src/mediamind/components/admin2/GovernanceSections.test.jsx`
- Modify: `frontend/src/mediamind/pages/Administration2.jsx`

**Interfaces:**
- Consumes: Task 2 primitives and existing read-only preview data.
- Produces: `FormsSection`, `ImportsSection`, `SecuritySection`, `RegistrySection`, and `RecordsSection`, all with local selection and no persistence callbacks.

- [ ] **Step 1: Write failing tests for every clickable-looking item**

Assert form preview selection, import error inspection, security rule inspection, hierarchical module/screen/section selection, record field detail, and visibly disabled create/import/edit actions.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- --run src/mediamind/components/admin2/GovernanceSections.test.jsx`

Expected: FAIL because the sections do not exist.

- [ ] **Step 3: Implement contextual read-only sections**

Replace unsupported counters with `—`; retain explicit demo labels where preview data is necessary; distinguish static information from selectable items.

- [ ] **Step 4: Add scoped error and legitimate-empty coverage**

Assert that an unavailable detail does not remove its master list and that empty states say what is missing without manufacturing records.

- [ ] **Step 5: Run the focused tests**

Run: `npm test -- --run src/mediamind/components/admin2/GovernanceSections.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/mediamind/components/admin2/GovernanceSections.jsx frontend/src/mediamind/components/admin2/GovernanceSections.test.jsx frontend/src/mediamind/pages/Administration2.jsx
git commit -m "feat(admin): completar detalhes de governanca"
```

### Task 5: Integrations, Settings, and Overview Navigation

**Files:**
- Create: `frontend/src/mediamind/components/admin2/OperationsSections.jsx`
- Create: `frontend/src/mediamind/components/admin2/OperationsSections.test.jsx`
- Modify: `frontend/src/mediamind/pages/Administration2.jsx`
- Modify: `frontend/src/mediamind/pages/Administration2.test.jsx`

**Interfaces:**
- Consumes: Task 2 primitives, active-tab URL setter, existing settings API, and existing local-demo settings storage.
- Produces: `OverviewSection({ onOpenTab })`, `IntegrationsSection`, and `SettingsSection({ localDemo })`.

- [ ] **Step 1: Write failing tests for internal overview navigation and operations details**

Assert that overview shortcuts change only `tab`, integration selection stays on the page, unsupported health values remain absent, settings retain unsaved values while changing section, and local demo never calls the settings API.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- --run src/mediamind/components/admin2/OperationsSections.test.jsx src/mediamind/pages/Administration2.test.jsx`

Expected: FAIL on missing contextual behavior.

- [ ] **Step 3: Implement the three sections and connect them to the route coordinator**

Preserve the current settings authorization and payload. Integration details may show only known inventory fields and must never expose credentials.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- --run src/mediamind/components/admin2/OperationsSections.test.jsx src/mediamind/pages/Administration2.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/mediamind/components/admin2/OperationsSections.jsx frontend/src/mediamind/components/admin2/OperationsSections.test.jsx frontend/src/mediamind/pages/Administration2.jsx frontend/src/mediamind/pages/Administration2.test.jsx
git commit -m "feat(admin): conectar operacao sem sair do contexto"
```

### Task 6: Responsive Visual Verification and Release Gate

**Files:**
- Modify: `docs/ADMINISTRATION2_VISUAL_AUDIT.md`
- Modify: `docs/ADMINISTRATION2_CHECKLIST.md`
- Modify only if a verified defect requires it: `frontend/src/mediamind/components/admin2/*.jsx`

**Interfaces:**
- Consumes: all prior tasks and the visual audit matrix.
- Produces: completed before/after evidence and an explicit pass/fail release gate for each Administration 2 tab.

- [ ] **Step 1: Run all focused Administration 2 tests**

Run: `npm test -- --run src/mediamind/pages/Administration2.test.jsx src/mediamind/components/admin2`

Expected: PASS.

- [ ] **Step 2: Run frontend quality gates**

Run: `npm run lint && npm run typecheck && npm run build && npm test -- --run`

Expected: all commands exit 0; known build warnings may be recorded but no new warning is accepted silently.

- [ ] **Step 3: Run the backend suite because the release includes the integrated Administration flow**

Run from `backend`: `python -m pytest`

Expected: PASS with only documented skips.

- [ ] **Step 4: Capture authenticated visual evidence for every tab at desktop and narrow viewport sizes**

Check alignment, density, contextual opening/closing, focus restoration, legitimate empty states, image fallbacks, clipping, overflow, and absence of accidental blank regions.

- [ ] **Step 5: Reconcile every visual audit row**

Mark each row `pass`, `blocked by missing backend`, or `not applicable`, with its screenshot/evidence and no unsupported claim of completion.

- [ ] **Step 6: Commit**

```bash
git add docs/ADMINISTRATION2_VISUAL_AUDIT.md docs/ADMINISTRATION2_CHECKLIST.md frontend/src/mediamind/components/admin2 frontend/src/mediamind/pages/Administration2.jsx frontend/src/mediamind/pages/Administration2.test.jsx
git commit -m "test(admin): validar convergencia visual e responsiva"
```

- [ ] **Step 7: Review commit scope before any push or deploy**

Verify `git status`, `git diff --check`, commit list against the remote branch, and absence of secrets, generated builds, logs, caches, or unrelated files. Push and Render deployment remain separate release actions under the existing production authorization and must be verified by commit hash and service health.

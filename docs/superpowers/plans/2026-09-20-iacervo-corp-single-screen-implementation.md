# IAcervo Corp Single-Screen Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every IAcervo Corp entry point render the same canonical screen component and bring Gestão, Acervo, and Administração materially closer to the approved visual references.

**Architecture:** A canonical screen registry owns ids, labels, icons, components, areas, and navigation metadata. Current tabs and the future column navigation resolve through that registry, while role policies only filter registry entries. Shared operational layout primitives provide the dense reference composition without duplicating domain screens.

**Tech Stack:** React 18, React Router, Tailwind CSS, Lucide, Vitest, Testing Library, FastAPI, SQLAlchemy, pytest.

**Spec:** `docs/superpowers/specs/2026-09-20-iacervo-corp-single-screen-architecture-design.md`

## Global Constraints

- Preserve the MediaMind identity and existing functional behavior.
- One screen id maps to one component implementation.
- Admin and superadmin always receive the complete screen catalog.
- Tenant scope comes from the authenticated server session.
- Never display illustrative values as real data.
- Keep demo accounts; Google login only authorizes an existing active local user.
- Do not publish, configure cloud, clean Docker, or create cross-repository packages.
- Maintain 100% backend coverage and 100% coverage for the configured migrated frontend slice.

## Review Focus

- A stale browser override must not reduce admin or superadmin access; Task 2 tests both roles with stored restrictions.
- An unknown or forbidden deep link must resolve to the first permitted screen; Task 2 tests both cases.
- Two navigation adapters must resolve a screen id to the exact same component reference; Task 1 tests identity, not only matching markup.
- Missing API data must render an integrated empty state rather than sample values; Tasks 4-6 test empty payloads.
- Narrow layouts must not clip KPI strips, actions, or tables; Tasks 3-6 include responsive browser checks at 390px and 1440px.

---

### Task 1: Canonical Corp screen registry

**Files:**
- Create: `frontend/src/mediamind/lib/corpScreenRegistry.jsx`
- Create: `frontend/src/mediamind/lib/corpScreenRegistry.test.jsx`
- Modify: `frontend/src/mediamind/lib/corpTabs.jsx`
- Modify: `frontend/src/mediamind/pages/Corp.jsx`

**Interfaces:**
- Produces: `CORP_SCREEN_REGISTRY`, `listCorpScreens(): CorpScreen[]`, `resolveCorpScreen(id: string): CorpScreen | null`, where `CorpScreen` contains `id`, `name`, `Icon`, `area`, and `Component`.
- Consumes: existing role page components and existing `CORP_TABS` ids.

- [ ] **Step 1: Write failing registry tests**

```jsx
import { describe, expect, it } from 'vitest';
import { CORP_SCREEN_REGISTRY, listCorpScreens, resolveCorpScreen } from './corpScreenRegistry';

describe('Corp screen registry', () => {
  it('has one unique component-bearing entry for every screen', () => {
    const screens = listCorpScreens();
    expect(new Set(screens.map((screen) => screen.id)).size).toBe(screens.length);
    expect(screens.every((screen) => typeof screen.Component === 'function')).toBe(true);
  });

  it('returns the same component reference to every navigation adapter', () => {
    const id = 'editor_video';
    expect(resolveCorpScreen(id).Component).toBe(CORP_SCREEN_REGISTRY[id].Component);
    expect(resolveCorpScreen('unknown')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `cd frontend && npm run test -- --run src/mediamind/lib/corpScreenRegistry.test.jsx`

Expected: FAIL because `corpScreenRegistry.jsx` does not exist.

- [ ] **Step 3: Create the registry and replace conditional rendering**

Create entries such as:

```jsx
export const CORP_SCREEN_REGISTRY = Object.fromEntries([
  { id: 'producao', name: 'Produção', Icon: Clapperboard, area: 'conteudo', Component: ProdutoraPage },
  { id: 'editor_video', name: 'Editor de vídeo', Icon: Scissors, area: 'conteudo', Component: EditorVideoPage },
  { id: 'admin_acessos', name: 'Administração', Icon: UserCog, area: 'administracao', Component: AdminAcessosPage },
].map((screen) => [screen.id, Object.freeze(screen)]));

export const listCorpScreens = () => Object.values(CORP_SCREEN_REGISTRY);
export const resolveCorpScreen = (id) => CORP_SCREEN_REGISTRY[id] || null;
```

Populate all current ids. Derive `CORP_TABS` from `listCorpScreens()` and replace `renderTab()` with:

```jsx
const screen = resolveCorpScreen(activeTab);
const ActiveScreen = screen?.Component;
return ActiveScreen ? <ActiveScreen /> : null;
```

- [ ] **Step 4: Run focused and full frontend checks**

Run: `cd frontend && npm run test -- --run src/mediamind/lib/corpScreenRegistry.test.jsx && npm run lint && npm run build`

Expected: registry tests, lint, and build PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/mediamind/lib/corpScreenRegistry.jsx frontend/src/mediamind/lib/corpScreenRegistry.test.jsx frontend/src/mediamind/lib/corpTabs.jsx frontend/src/mediamind/pages/Corp.jsx
git commit -m "refactor(corp): resolve profiles through one screen registry"
```

### Task 2: Safe navigation and privileged access

**Files:**
- Create: `frontend/src/mediamind/lib/corpNavigation.js`
- Create: `frontend/src/mediamind/lib/corpNavigation.test.js`
- Modify: `frontend/src/mediamind/pages/Corp.jsx`
- Modify: `frontend/src/mediamind/lib/permissions.js`
- Modify: `frontend/src/mediamind/lib/roleCatalog.js`

**Interfaces:**
- Consumes: `listCorpScreens()` and `filterTabsForUser(tabs, user)`.
- Produces: `resolveAllowedCorpScreen(requestedId, allowedScreens): string | null`.

- [ ] **Step 1: Write failing navigation tests**

```js
import { describe, expect, it } from 'vitest';
import { resolveAllowedCorpScreen } from './corpNavigation';

const allowed = [{ id: 'producao' }, { id: 'editor_video' }];

describe('Corp navigation', () => {
  it('keeps a permitted deep link', () => expect(resolveAllowedCorpScreen('editor_video', allowed)).toBe('editor_video'));
  it('falls back for forbidden and unknown links', () => {
    expect(resolveAllowedCorpScreen('admin_acessos', allowed)).toBe('producao');
    expect(resolveAllowedCorpScreen('missing', allowed)).toBe('producao');
  });
  it('returns null when no screen is allowed', () => expect(resolveAllowedCorpScreen('producao', [])).toBeNull());
});
```

- [ ] **Step 2: Add stale-override assertions to `roleCatalog.test.js`**

Assert that both `{role: 'admin'}` and `{role: 'superadmin'}` receive every registry id even when local storage records `role: 'editor'` and removes `admin_acessos`.

- [ ] **Step 3: Run tests and verify `corpNavigation` is missing**

Run: `cd frontend && npm run test -- --run src/mediamind/lib/corpNavigation.test.js src/mediamind/lib/roleCatalog.test.js`

Expected: navigation suite FAILS before implementation; privileged tests PASS with the existing security fix.

- [ ] **Step 4: Implement safe resolution and use it for initial state and query changes**

```js
export function resolveAllowedCorpScreen(requestedId, allowedScreens) {
  if (!allowedScreens.length) return null;
  return allowedScreens.some((screen) => screen.id === requestedId)
    ? requestedId
    : allowedScreens[0].id;
}
```

In `Corp.jsx`, derive the active id through this function whenever the query or allowed set changes. Do not read `window.location` directly; use `useSearchParams` so browser navigation remains reactive.

- [ ] **Step 5: Run full frontend tests and commit**

Run: `cd frontend && npm run test -- --run && npm run lint && npm run build`

```powershell
git add frontend/src/mediamind/lib/corpNavigation.js frontend/src/mediamind/lib/corpNavigation.test.js frontend/src/mediamind/lib/permissions.js frontend/src/mediamind/lib/roleCatalog.js frontend/src/mediamind/pages/Corp.jsx
git commit -m "fix(corp): keep role navigation inside allowed screens"
```

### Task 3: Shared dense operational shell

**Files:**
- Create: `frontend/src/mediamind/components/corp/operational/OperationalPage.jsx`
- Create: `frontend/src/mediamind/components/corp/operational/OperationalPage.test.jsx`
- Create: `frontend/src/mediamind/components/corp/operational/OperationalKpis.jsx`
- Create: `frontend/src/mediamind/components/corp/operational/OperationalPanel.jsx`
- Create: `frontend/src/mediamind/components/corp/operational/OperationalTable.jsx`
- Modify: `frontend/src/mediamind/styles.css` or the active MediaMind stylesheet discovered before implementation.

**Interfaces:**
- Produces: `OperationalPage({title, subtitle, actions, children})`, `OperationalKpis({items})`, `OperationalPanel({title, action, children})`, `OperationalTable({columns, rows, getRowKey, emptyMessage})`.
- Consumes: existing color tokens and Lucide icons.

- [ ] **Step 1: Write component tests for hierarchy and empty state**

```jsx
render(<OperationalPage title="Gestão" subtitle="Visão geral"><OperationalKpis items={[{id:'a', label:'Ativos', value:3}]} /></OperationalPage>);
expect(screen.getByRole('heading', {name:'Gestão'})).toBeInTheDocument();
expect(screen.getByText('Ativos')).toBeInTheDocument();
expect(screen.getByText('3')).toBeInTheDocument();

render(<OperationalTable columns={[{key:'name', label:'Nome'}]} rows={[]} getRowKey={(row) => row.id} emptyMessage="Nenhum registro" />);
expect(screen.getByText('Nenhum registro')).toBeInTheDocument();
```

- [ ] **Step 2: Run tests and verify component imports fail**

Run: `cd frontend && npm run test -- --run src/mediamind/components/corp/operational/OperationalPage.test.jsx`

- [ ] **Step 3: Implement compact, responsive primitives**

Use a low header, horizontally wrapping KPI grid, `minmax(0,1fr)` panel grid, horizontally scrollable tables, visible focus rings, and no fixed content heights. At 390px, actions wrap below the title and KPI cards become two columns; at 1440px, KPI items share one row where space permits.

- [ ] **Step 4: Run tests, lint, and build**

Run: `cd frontend && npm run test -- --run src/mediamind/components/corp/operational/OperationalPage.test.jsx && npm run lint && npm run build`

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/mediamind/components/corp/operational frontend/src/mediamind/styles.css
git commit -m "feat(corp): add shared operational screen shell"
```

### Task 4: Gestão reference composition

**Files:**
- Modify: `frontend/src/mediamind/pages/Management.jsx`
- Modify: `frontend/src/mediamind/components/corp/roles/GestaoPage.jsx`
- Create: `frontend/src/mediamind/components/management/ManagementOverview.jsx`
- Create: `frontend/src/mediamind/components/management/ManagementOverview.test.jsx`
- Modify: `backend/app/api/v1/management.py`
- Modify: `backend/tests/test_management_api.py`

**Interfaces:**
- Consumes: operational shell and `getManagementOverview()`.
- Produces: one `ManagementOverview` component reused by `/management` and the Corp Gestão screen.

- [ ] **Step 1: Write reuse and empty-state tests**

Test that both entry points render `ManagementOverview`, and that an overview with empty calendar/social metrics renders explicit empty messages without sample people or numbers.

- [ ] **Step 2: Add backend tests for alert and pipeline aggregates**

Seed tenant records with publication deadlines, processing states, production stages, and another tenant's records. Assert the response returns only the selected tenant's `pipeline`, `weekly_summary`, and `alerts`.

- [ ] **Step 3: Run focused tests and observe failures**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_management_api.py -q`

Run: `cd frontend && npm run test -- --run src/mediamind/components/management/ManagementOverview.test.jsx`

- [ ] **Step 4: Implement the reference hierarchy**

Render: header and date context; compact KPI strip; pipeline and stage-time panels; weekly summary; publication calendar; social integration empty/real state; actionable alerts. Use only response values.

- [ ] **Step 5: Verify and commit**

Run: `.\.venv\Scripts\python.exe -m pytest --cov=app --cov-fail-under=100 -q`

Run: `cd frontend && npm run test -- --run --coverage && npm run lint && npm run build`

```powershell
git add backend/app/api/v1/management.py backend/tests/test_management_api.py frontend/src/mediamind/pages/Management.jsx frontend/src/mediamind/components/corp/roles/GestaoPage.jsx frontend/src/mediamind/components/management
git commit -m "feat(management): match operational reference composition"
```

### Task 5: Acervo reference composition

**Files:**
- Modify: `frontend/src/mediamind/pages/Acervo.jsx`
- Modify: `frontend/src/mediamind/components/corp/roles/CedocPage.jsx`
- Create: `frontend/src/mediamind/components/acervo/AcervoFilesScreen.jsx`
- Create: `frontend/src/mediamind/components/acervo/AcervoUsersScreen.jsx`
- Create: `frontend/src/mediamind/components/acervo/AcervoSystemScreen.jsx`
- Create: `frontend/src/mediamind/components/acervo/AcervoScreens.test.jsx`

**Interfaces:**
- Consumes: operational shell, tenant assets, audit records, and management service health.
- Produces: the same three screen components for Acervo tabs and CEDOC/profile entry points.

- [ ] **Step 1: Write tests proving component reuse and honest empty states**

Assert Arquivos shows real assets; Usuários shows no fabricated library/user when the payload is empty; Sistema shows API/database health and explicitly marks unavailable CPU/GPU monitoring.

- [ ] **Step 2: Run tests and verify missing screen components**

Run: `cd frontend && npm run test -- --run src/mediamind/components/acervo/AcervoScreens.test.jsx`

- [ ] **Step 3: Extract and compose the three canonical screens**

Move existing logic without duplication. Match the reference order: compact KPI strip, service/pipeline table, resource panel, model/integration panel, and recent incidents. Never synthesize resource percentages.

- [ ] **Step 4: Verify responsive layout at 390px and 1440px**

Start the local app, open `/acervo?tab=acervo`, `/acervo?tab=admin`, `/acervo?tab=monitoring`, and the CEDOC entry. Confirm no horizontal page clipping; only tables may scroll inside their panel.

- [ ] **Step 5: Run checks and commit**

Run: `cd frontend && npm run test -- --run && npm run lint && npm run build`

```powershell
git add frontend/src/mediamind/pages/Acervo.jsx frontend/src/mediamind/components/acervo frontend/src/mediamind/components/corp/roles/CedocPage.jsx
git commit -m "refactor(acervo): reuse canonical operational screens"
```

### Task 6: Administração reference composition

**Files:**
- Modify: `frontend/src/mediamind/components/corp/roles/AdminAcessosPage.jsx`
- Create: `frontend/src/mediamind/components/admin/AdminOverviewScreen.jsx`
- Create: `frontend/src/mediamind/components/admin/AdminUsersScreen.jsx`
- Create: `frontend/src/mediamind/components/admin/AdminUserDetailScreen.jsx`
- Create: `frontend/src/mediamind/components/admin/AdminAccessProfilesScreen.jsx`
- Create: `frontend/src/mediamind/components/admin/AdminScreens.test.jsx`
- Modify: `frontend/src/api/permissions.js`
- Modify: `frontend/src/api/permissions.test.js`

**Interfaces:**
- Consumes: memberships, role catalog, permission groups, individual screen overrides.
- Produces: canonical admin overview, user list/detail, and role/profile access screens registered under Administration subtabs.

- [ ] **Step 1: Write access and empty-state tests**

Cover active/inactive users, missing optional profile data, inherited permissions, individual exceptions, superadmin visibility, and a membership API failure that preserves the last safe server state.

- [ ] **Step 2: Run tests and verify missing canonical screens**

Run: `cd frontend && npm run test -- --run src/mediamind/components/admin/AdminScreens.test.jsx src/api/permissions.test.js`

- [ ] **Step 3: Implement the reference hierarchy with existing backend contracts**

Create overview KPIs from memberships/groups; render searchable user table; user detail with identity, role, team/scope placeholders explicitly marked unavailable when absent; access profiles and individual exceptions from real membership fields. Keep mutations through `permissions.js` only.

- [ ] **Step 4: Verify privileged and non-privileged behavior**

Admin and superadmin see all Administration screens. Other roles cannot deep-link to them and fall back to their first allowed screen.

- [ ] **Step 5: Run checks and commit**

Run: `cd frontend && npm run test -- --run --coverage && npm run lint && npm run build`

```powershell
git add frontend/src/mediamind/components/admin frontend/src/mediamind/components/corp/roles/AdminAcessosPage.jsx frontend/src/api/permissions.js frontend/src/api/permissions.test.js
git commit -m "feat(admin): align access management with reference screens"
```

### Task 7: Visual proof, documentation, and final gate

**Files:**
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `project-status.json`
- Modify: `docs/FRONTEND_VALIDATION_MATRIX.md`
- Modify: `../_documentacao/RETOMADA.md`

**Interfaces:**
- Consumes: completed canonical screens and all verification output.
- Produces: evidence-backed 1C status; does not mark the entire 1C complete if remaining profiles still diverge.

- [ ] **Step 1: Run complete automated verification**

Run: `.\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing --cov-fail-under=100 -q`

Run: `cd frontend && npm run test -- --run --coverage && npm run lint && npm run build`

Expected: all tests PASS; backend and configured frontend slice report 100% coverage.

- [ ] **Step 2: Run browser matrix**

At desktop 1440x900 and mobile 390x844, validate login as Alex superadmin, all 32 Corp destinations, forbidden-role fallback, direct URLs, Gestão, Acervo, Administração, refresh, and logout. Capture only local screenshots with no secrets.

- [ ] **Step 3: Compare with reference composition**

For Gestão, Acervo, and Administração, verify header density, KPI hierarchy, panel grid, operational tables, alert visibility, responsive behavior, and absence of fabricated metrics. Record remaining visual gaps by screen.

- [ ] **Step 4: Update status honestly**

Record exact test counts and remaining blockers. Keep M0 blocked while PostgreSQL/browser gates remain unproven. Mark only the implemented 1C sections as complete.

- [ ] **Step 5: Commit documentation**

```powershell
git add docs/PROJECT_STATUS.md project-status.json docs/FRONTEND_VALIDATION_MATRIX.md
git commit -m "docs: record canonical Corp screen validation"
```

Update `../_documentacao/RETOMADA.md` separately because the HUB root is not a Git repository.

# Administration and Bulk Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a nova Administração e uma bancada segura de importação/exportação para usuários, mídias, arquivos, configurações, pessoas, programas, produções e metadados.

**Architecture:** A Administração será um contêiner de guias que preserva a matriz atual. O motor de dados usa schemas registrados por domínio, sessões temporárias, transformações declarativas, validação e dry run no backend; a grade React edita uma projeção e nunca grava diretamente.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Python `csv`, `openpyxl`, React 18, React Router, Tailwind, Vitest, Testing Library e pytest.

**Spec:** `docs/superpowers/specs/2026-09-23-administration-bulk-data-design.md`

## Global Constraints

- Preservar `AdminAcessosPage` como `Acessos por Função`.
- Pessoa e conta continuam conceitos separados; este corte não inventa prontuário pessoal.
- CSV UTF-8 e XLSX são os únicos formatos de entrada inicial.
- Fórmulas, macros, links e conteúdo ativo não são executados.
- Nenhuma escrita ocorre antes de validação, dry run e confirmação.
- Toda sessão, job, template, arquivo e exportação pertence a tenant e usuário.
- Senhas, tokens e secrets nunca são importáveis/exportáveis.
- A extração para pacote comum do HUB ocorre somente depois de o MediaMind provar os contratos.

## Review Focus

- XLSX com fórmula/macros deve mostrar aviso e nunca executar conteúdo ativo.
- Cabeçalhos duplicados, encoding inválido e CSV sem cabeçalho devem produzir diagnóstico corrigível.
- Sessão expirada ou de outro tenant não pode ser vista, retomada nem confirmada.
- Atualização de usuário por e-mail deve ser determinística e nunca elevar para superadmin por planilha.
- Exportação deve omitir secrets e campos fora do escopo mesmo quando solicitados manualmente.

---

### Task 1: Criar o contêiner de Administração

**Files:**
- Create: `frontend/src/mediamind/pages/Administration.jsx`
- Create: `frontend/src/mediamind/components/administration/AdministrationOverview.jsx`
- Create: `frontend/src/mediamind/components/administration/AdminAccessByRole.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/mediamind/Shell.jsx`
- Test: `frontend/src/mediamind/pages/Administration.test.jsx`

**Interfaces:**
- Produces: route `/administration?tab=<id>` and tab registry `ADMIN_TABS`.

- [ ] **Step 1: Write failing navigation tests**

```jsx
it('preserves the access matrix inside Acessos por Função', async () => {
  renderAdministration('/administration?tab=access');
  expect(await screen.findByText('Catálogo de cargos & funções')).toBeVisible();
});

it('redirects an unknown tab to overview', () => {
  renderAdministration('/administration?tab=unknown');
  expect(screen.getByRole('heading', { name: 'Administração' })).toBeVisible();
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd frontend; npm run test -- --run src/mediamind/pages/Administration.test.jsx`  
Expected: FAIL because the route/page does not exist.

- [ ] **Step 3: Implement shell and route**

```jsx
const ADMIN_TABS = [
  ['overview', 'Visão geral'], ['users', 'Usuários'], ['access', 'Acessos por Função'],
  ['profiles', 'Perfis e Funções'], ['permissions', 'Permissões'], ['teams', 'Equipes / Setores'],
  ['modules', 'Telas e Módulos'], ['forms', 'Formulários'], ['bulk-data', 'Importação e Exportação'],
  ['integrations', 'Integrações'], ['security', 'Segurança'], ['settings', 'Configurações'],
];
```

Wrap the existing `AdminAcessosPage` in `AdminAccessByRole`; do not copy its logic.

- [ ] **Step 4: Run component tests**

Run: `cd frontend; npm run test -- --run src/mediamind/pages/Administration.test.jsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/mediamind/pages/Administration.jsx frontend/src/mediamind/components/administration/AdministrationOverview.jsx frontend/src/mediamind/components/administration/AdminAccessByRole.jsx frontend/src/App.jsx frontend/src/mediamind/Shell.jsx frontend/src/mediamind/pages/Administration.test.jsx
git commit -m "feat(admin): add administration workspace"
```

### Task 2: Entregar Usuários e detalhe lateral

**Files:**
- Create: `frontend/src/api/administration.js`
- Create: `frontend/src/api/administration.test.js`
- Create: `frontend/src/mediamind/components/administration/AdminUsers.jsx`
- Create: `frontend/src/mediamind/components/administration/AdminUserDetail.jsx`
- Create: `frontend/src/mediamind/lib/effectiveAccess.js`
- Create: `frontend/src/mediamind/lib/effectiveAccess.test.js`
- Modify: `backend/app/api/v1/memberships.py`
- Test: `backend/tests/test_memberships_api.py`

**Interfaces:**
- Produces: `GET /api/v1/memberships/{id}/administration-detail` and `explainEffectiveAccess(detail)`.

- [ ] **Step 1: Write failing access explanation tests**

```javascript
it('lets an individual deny override inherited allow', () => {
  const result = explainEffectiveAccess({ profile: ['asset.download'], individualDeny: ['asset.download'] });
  expect(result['asset.download']).toEqual({ allowed: false, source: 'Exceção individual' });
});
```

```python
def test_user_detail_does_not_cross_tenant(client, auth_headers, other_membership):
    response = client.get(f"/api/v1/memberships/{other_membership.id}/administration-detail", headers=auth_headers)
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd frontend; npm run test -- --run src/mediamind/lib/effectiveAccess.test.js src/api/administration.test.js`  
Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_memberships_api.py -q`  
Expected: FAIL for missing detail/explanation.

- [ ] **Step 3: Implement endpoint, list and side detail**

Return person/account fields separately plus role, permission group, screens, effective permissions, sessions and audit summary. In desktop, selection opens the right panel; below `lg`, render the same component as the main pane.

- [ ] **Step 4: Run targeted tests**

Run both commands from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/api/administration.js frontend/src/api/administration.test.js frontend/src/mediamind/components/administration/AdminUsers.jsx frontend/src/mediamind/components/administration/AdminUserDetail.jsx frontend/src/mediamind/lib/effectiveAccess.js frontend/src/mediamind/lib/effectiveAccess.test.js backend/app/api/v1/memberships.py backend/tests/test_memberships_api.py
git commit -m "feat(admin): add user administration detail"
```

### Task 3: Criar modelo de sessão e parser seguro

**Files:**
- Modify: `pyproject.toml`
- Modify: `requirements.lock`
- Create: `backend/app/models/bulk_data.py`
- Create: `backend/app/schemas/bulk_data.py`
- Create: `backend/app/services/bulk_data/parsers.py`
- Create: `alembic/versions/0008_bulk_data_sessions.py`
- Test: `backend/tests/test_bulk_data_parsers.py`
- Test: `backend/tests/test_bulk_data_models.py`

**Interfaces:**
- Produces: `parse_tabular_file(stream, filename, options) -> ParsedWorkbook` and `ImportSession`.

- [ ] **Step 1: Write failing parser safety tests**

```python
def test_xlsx_formula_is_not_evaluated(xlsx_with_formula):
    book = parse_tabular_file(xlsx_with_formula, "users.xlsx", {})
    assert book.sheets[0].rows[0]["total"].kind == "formula"
    assert book.warnings == ["FORMULAS_NOT_EXECUTED"]

def test_duplicate_headers_are_reported(csv_bytes):
    with pytest.raises(TabularParseError) as error:
        parse_tabular_file(csv_bytes(b"email,email\na@x.test,b@x.test"), "users.csv", {})
    assert error.value.code == "DUPLICATE_HEADERS"
```

- [ ] **Step 2: Run and confirm RED**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_bulk_data_parsers.py backend\tests\test_bulk_data_models.py -q`  
Expected: FAIL because parser and models are missing.

- [ ] **Step 3: Add `openpyxl` and implement parser/models**

Open XLSX with `read_only=True`, `data_only=False`, never load VBA, cap compressed/uncompressed size, sheets, rows and columns, and normalize headers without hiding duplicates. Store temporary file reference/checksum, not the file body in the database.

```python
@dataclass(frozen=True)
class ParsedWorkbook:
    sheets: tuple[ParsedSheet, ...]
    warnings: tuple[str, ...]
```

- [ ] **Step 4: Lock dependencies and run tests**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_bulk_data_parsers.py backend\tests\test_bulk_data_models.py -q`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add pyproject.toml requirements.lock backend/app/models/bulk_data.py backend/app/schemas/bulk_data.py backend/app/services/bulk_data/parsers.py alembic/versions/0008_bulk_data_sessions.py backend/tests/test_bulk_data_parsers.py backend/tests/test_bulk_data_models.py
git commit -m "feat(import): add safe tabular sessions"
```

### Task 4: Implementar transformações declarativas

**Files:**
- Create: `backend/app/services/bulk_data/transforms.py`
- Create: `frontend/src/mediamind/lib/bulkData/operations.js`
- Create: `frontend/src/mediamind/lib/bulkData/reducer.js`
- Test: `backend/tests/test_bulk_data_transforms.py`
- Test: `frontend/src/mediamind/lib/bulkData/operations.test.js`
- Test: `frontend/src/mediamind/lib/bulkData/reducer.test.js`

**Interfaces:**
- Produces: versioned operations `rename`, `remove`, `reorder`, `cast`, `replace`, `fill`, `split`, `combine`, `trim`, `case`, `ignore_row` and undo/redo reducer.

- [ ] **Step 1: Write failing deterministic tests**

```python
def test_steps_replay_without_mutating_source():
    source = [{" Nome ": "  ANA  "}]
    result = apply_steps(source, [Rename(" Nome ", "nome"), Trim("nome"), ChangeCase("nome", "title")])
    assert result == [{"nome": "Ana"}]
    assert source == [{" Nome ": "  ANA  "}]
```

```javascript
it('undo restores the previous recipe', () => {
  const changed = reducer(initialState, { type: 'addStep', step: { op: 'trim', column: 'name' } });
  expect(reducer(changed, { type: 'undo' }).steps).toEqual([]);
});
```

- [ ] **Step 2: Run and confirm RED**

Run backend and frontend tests above. Expected: FAIL for missing operations.

- [ ] **Step 3: Implement operation registry and reducer**

```python
TRANSFORMS = {"rename": apply_rename, "remove": apply_remove, "cast": apply_cast,
              "replace": apply_replace, "split": apply_split, "combine": apply_combine,
              "trim": apply_trim, "case": apply_case, "ignore_row": apply_ignore}
```

Reject unknown operations and invalid parameters with stable codes. Frontend operations generate the same JSON contract; backend is authoritative.

- [ ] **Step 4: Run targeted tests**

Expected: all backend/frontend transformation tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/services/bulk_data/transforms.py backend/tests/test_bulk_data_transforms.py frontend/src/mediamind/lib/bulkData/operations.js frontend/src/mediamind/lib/bulkData/operations.test.js frontend/src/mediamind/lib/bulkData/reducer.js frontend/src/mediamind/lib/bulkData/reducer.test.js
git commit -m "feat(import): add replayable transformations"
```

### Task 5: Criar schemas, validação e dry run

**Files:**
- Create: `backend/app/services/bulk_data/registry.py`
- Create: `backend/app/services/bulk_data/validators.py`
- Create: `backend/app/services/bulk_data/dry_run.py`
- Test: `backend/tests/test_bulk_data_validation.py`
- Test: `backend/tests/test_bulk_data_dry_run.py`

**Interfaces:**
- Produces: `IMPORT_SCHEMAS`, `validate_rows(...) -> ValidationReport`, `dry_run(...) -> DryRunReport`.

- [ ] **Step 1: Write failing security and outcome tests**

```python
def test_user_schema_rejects_password_and_superadmin_elevation():
    report = validate_rows("users.v1", [{"email": "a@x.test", "password": "secret", "role": "superadmin"}])
    assert {issue.code for issue in report.issues} == {"FIELD_NOT_IMPORTABLE", "ROLE_NOT_ASSIGNABLE"}

def test_dry_run_classifies_create_update_unchanged_and_rejected(session, tenant):
    report = dry_run(session, tenant.id, "users.v1", prepared_rows())
    assert report.counts == {"create": 1, "update": 1, "unchanged": 1, "ignored": 0, "rejected": 1}
```

- [ ] **Step 2: Run and confirm RED**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_bulk_data_validation.py backend\tests\test_bulk_data_dry_run.py -q`  
Expected: FAIL because registry/validation are missing.

- [ ] **Step 3: Implement four versioned schemas**

Register `users.v1`, `media.v1`, `files.v1`, `settings.v1`, `people.v1`, `programs.v1`, `productions.v1` and `metadata.v1` with exact fields, aliases, types, required fields, identity keys, writable roles and domain validator. Settings and metadata use allowlists; files accept logical storage references only; people do not create accounts implicitly; productions cannot skip protected workflow stages.

- [ ] **Step 4: Run validation tests**

Expected: PASS, including cross-tenant reference, duplicate identity, invalid duration/checksum and forbidden setting key.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/services/bulk_data/registry.py backend/app/services/bulk_data/validators.py backend/app/services/bulk_data/dry_run.py backend/tests/test_bulk_data_validation.py backend/tests/test_bulk_data_dry_run.py
git commit -m "feat(import): validate and simulate bulk changes"
```

### Task 6: Expor API de sessão, prévia e simulação

**Files:**
- Create: `backend/app/api/v1/bulk_data.py`
- Modify: `backend/app/api/v1/__init__.py`
- Test: `backend/tests/test_bulk_data_api.py`
- Create: `frontend/src/api/bulkData.js`
- Create: `frontend/src/api/bulkData.test.js`

**Interfaces:**
- Produces session, preview, mapping, steps, validate and dry-run endpoints from the spec.

- [ ] **Step 1: Write failing API boundary tests**

```python
def test_expired_session_cannot_dry_run(client, auth_headers, expired_session):
    response = client.post(f"/api/v1/bulk-data/sessions/{expired_session.id}/dry-run", headers=auth_headers)
    assert response.status_code == 410
    assert response.json()["error_code"] == "IMPORT_SESSION_EXPIRED"
```

- [ ] **Step 2: Run and confirm RED**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_bulk_data_api.py -q`  
Expected: FAIL with route not found.

- [ ] **Step 3: Implement endpoints and client**

`POST /sessions` accepts multipart upload plus schema. Every loader filters `tenant_id` and `created_by`; preview is paginated and never returns the complete file blindly. `PUT /steps` replaces the recipe with optimistic `version`.

- [ ] **Step 4: Run API/client tests**

Run backend test and `cd frontend; npm run test -- --run src/api/bulkData.test.js`. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/api/v1/bulk_data.py backend/app/api/v1/__init__.py backend/tests/test_bulk_data_api.py frontend/src/api/bulkData.js frontend/src/api/bulkData.test.js
git commit -m "feat(import): expose preview and dry-run API"
```

### Task 7: Construir a bancada estilo Power Query

**Files:**
- Create: `frontend/src/mediamind/components/administration/bulk-data/BulkDataWorkbench.jsx`
- Create: `frontend/src/mediamind/components/administration/bulk-data/SourcePanel.jsx`
- Create: `frontend/src/mediamind/components/administration/bulk-data/DataGrid.jsx`
- Create: `frontend/src/mediamind/components/administration/bulk-data/ColumnInspector.jsx`
- Create: `frontend/src/mediamind/components/administration/bulk-data/AppliedSteps.jsx`
- Create: `frontend/src/mediamind/components/administration/bulk-data/MappingPanel.jsx`
- Create: `frontend/src/mediamind/components/administration/bulk-data/ValidationSummary.jsx`
- Create: `frontend/src/mediamind/components/administration/bulk-data/DryRunReview.jsx`
- Test: `frontend/src/mediamind/components/administration/bulk-data/BulkDataWorkbench.test.jsx`

**Interfaces:**
- Consumes: Task 6 client and Task 4 reducer.
- Produces: complete upload-to-dry-run UI.

- [ ] **Step 1: Write failing user-journey tests**

```jsx
it('edits a cell, validates and shows dry-run effects before commit', async () => {
  render(<BulkDataWorkbench schema="users.v1" />);
  await uploadCsv('nome,email\nAna,ana@x.test');
  await user.dblClick(await screen.findByRole('gridcell', { name: 'Ana' }));
  await user.keyboard('{Control>}a{/Control}Ana Silva{Enter}');
  await user.click(screen.getByRole('button', { name: 'Simular importação' }));
  expect(await screen.findByText('1 será criado')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeEnabled();
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd frontend; npm run test -- --run src/mediamind/components/administration/bulk-data/BulkDataWorkbench.test.jsx`  
Expected: FAIL because workbench is missing.

- [ ] **Step 3: Implement accessible three-pane workbench**

Use `role="grid"`, keyboard cell navigation, explicit edit mode, sticky validation footer, visible applied steps and confirmation modal that repeats counts. Disable commit whenever the current recipe version differs from the validated dry run.

- [ ] **Step 4: Run tests, lint and build**

Run: `cd frontend; npm run test -- --run src/mediamind/components/administration/bulk-data/BulkDataWorkbench.test.jsx; npm run lint; npm run typecheck; npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/mediamind/components/administration/bulk-data
git commit -m "feat(import): add editable bulk data workbench"
```

### Task 8: Executar importação de usuários com resultado por linha

**Files:**
- Create: `backend/app/services/bulk_data/executor.py`
- Modify: `backend/app/api/v1/bulk_data.py`
- Test: `backend/tests/test_bulk_data_execution.py`
- Create: `frontend/src/mediamind/components/administration/bulk-data/ImportHistory.jsx`
- Test: `frontend/src/mediamind/components/administration/bulk-data/ImportHistory.test.jsx`

**Interfaces:**
- Produces: `commit_import(...) -> ImportJob`, job status, row results and rejected CSV.

- [ ] **Step 1: Write failing idempotency/privilege tests**

```python
def test_same_commit_key_returns_same_job(session, validated_user_session, current):
    first = commit_import(session, current, validated_user_session.id, "commit-1")
    second = commit_import(session, current, validated_user_session.id, "commit-1")
    assert first.id == second.id

def test_user_import_never_sets_password_or_superadmin(session, prepared_user_rows, current):
    job = run_import(session, current, prepared_user_rows)
    imported = find_user(session, "ana@x.test")
    assert imported.password_hash == ""
    assert imported_membership(session, imported.id).role != "superadmin"
```

- [ ] **Step 2: Run and confirm RED**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_bulk_data_execution.py -q`  
Expected: FAIL because executor is missing.

- [ ] **Step 3: Implement batched execution and history**

Create/update by normalized e-mail within the tenant membership scope. Account creation uses invitation state, never a planilha password. Persist one `ImportRowResult` for every source row and audit summary plus correlation ID.

- [ ] **Step 4: Run backend/frontend targeted tests**

Run backend command and `cd frontend; npm run test -- --run src/mediamind/components/administration/bulk-data/ImportHistory.test.jsx`. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/services/bulk_data/executor.py backend/app/api/v1/bulk_data.py backend/tests/test_bulk_data_execution.py frontend/src/mediamind/components/administration/bulk-data/ImportHistory.jsx frontend/src/mediamind/components/administration/bulk-data/ImportHistory.test.jsx
git commit -m "feat(import): execute audited user imports"
```

### Task 9: Implementar exportação e adaptadores restantes

**Files:**
- Create: `backend/app/services/bulk_data/exporters.py`
- Modify: `backend/app/services/bulk_data/executor.py`
- Modify: `backend/app/api/v1/bulk_data.py`
- Test: `backend/tests/test_bulk_data_exports.py`
- Test: `backend/tests/test_bulk_data_domain_adapters.py`
- Modify: `frontend/src/mediamind/components/administration/bulk-data/BulkDataWorkbench.jsx`

**Interfaces:**
- Produces: exports CSV/XLSX and import adapters `media.v1`, `files.v1`, `settings.v1`, `people.v1`, `programs.v1`, `productions.v1` and `metadata.v1`.

- [ ] **Step 1: Write failing privacy and domain tests**

```python
def test_export_omits_secret_and_other_tenant(client, auth_headers, tenants_with_settings):
    result = request_export(client, auth_headers, "settings.v1", ["key", "value", "secret"])
    rows = download_export(client, auth_headers, result["job_id"])
    assert "secret" not in rows.headers
    assert all(row["tenant_id"] == tenants_with_settings.current.id for row in rows)
```

- [ ] **Step 2: Run and confirm RED**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_bulk_data_exports.py backend\tests\test_bulk_data_domain_adapters.py -q`  
Expected: FAIL for missing exporter/adapters.

- [ ] **Step 3: Implement allowlisted exporters/adapters**

Media writes tenant records with normalized audiovisual metadata; files write logical storage references and checksum only; settings accept keys from `IMPORTABLE_SETTINGS`; people remain separate from accounts; programs and productions validate references and safe initial states; metadata accepts only keys registered for the target entity. Large exports use job status and temporary authorized download.

- [ ] **Step 4: Run targeted tests**

Expected: PASS for CSV/XLSX, tenant boundary, field allowlist, invalid path and forbidden key.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/services/bulk_data/exporters.py backend/app/services/bulk_data/executor.py backend/app/api/v1/bulk_data.py backend/tests/test_bulk_data_exports.py backend/tests/test_bulk_data_domain_adapters.py frontend/src/mediamind/components/administration/bulk-data/BulkDataWorkbench.jsx
git commit -m "feat(import): add exports and domain adapters"
```

### Task 10: Completar guias administrativas e gate de regressão

**Files:**
- Create: `frontend/src/mediamind/components/administration/AdminProfiles.jsx`
- Create: `frontend/src/mediamind/components/administration/AdminPermissions.jsx`
- Create: `frontend/src/mediamind/components/administration/AdminTeams.jsx`
- Create: `frontend/src/mediamind/components/administration/AdminModules.jsx`
- Create: `frontend/src/mediamind/components/administration/AdminForms.jsx`
- Create: `frontend/src/mediamind/components/administration/AdminIntegrations.jsx`
- Create: `frontend/src/mediamind/components/administration/AdminSecurity.jsx`
- Create: `frontend/src/mediamind/components/administration/AdminSettings.jsx`
- Test: `frontend/src/mediamind/components/administration/AdministrationScreens.test.jsx`
- Modify: `docs/CODEX_BACKLOG.md`
- Modify: `docs/CODEX_HANDOFF.md`
- Modify: `docs/PROJECT_STATUS.md`

**Interfaces:**
- Produces all 12 reachable Administration guides; actions use existing APIs or are visibly disabled with an explanation when their backend capability is absent.

- [ ] **Step 1: Write failing screen/action tests**

```jsx
it.each(['Perfis e Funções', 'Permissões', 'Equipes / Setores', 'Telas e Módulos', 'Formulários', 'Integrações', 'Segurança', 'Configurações'])
  ('opens %s with contextual content', async (label) => {
    render(<Administration />);
    await user.click(screen.getByRole('button', { name: label }));
    expect(screen.getByRole('main')).toHaveTextContent(/ativo|configurado|nenhum|criar|gerenciar/i);
  });
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd frontend; npm run test -- --run src/mediamind/components/administration/AdministrationScreens.test.jsx`  
Expected: FAIL because guides are missing.

- [ ] **Step 3: Implement contextual screens**

Profiles/permissions consume permission-group APIs; teams aggregate memberships; modules show screen and action permissions separately; security shows session/lockout/invite data available from backend. Forms, integrations and settings show real configured records and expose only actions supported by APIs.

- [ ] **Step 4: Run complete quality gate**

Run: `.\.venv\Scripts\python.exe -m pytest -q`  
Run: `.\.venv\Scripts\python.exe -m ruff check backend tests`  
Run: `cd frontend; npm run test -- --run --coverage; npm run lint; npm run typecheck; npm run build`  
Expected: all pass; record every pre-existing warning separately.

- [ ] **Step 5: Manual QA**

Test superadmin and scoped manager, desktop and narrow viewport, CSV/XLSX, invalid encoding, duplicate headers, edited cells, undo/redo, errors-only filter, dry run, duplicate click, rejected rows, export, session expiry and cross-tenant denial. Compare Administration to PDF pages 19–25.

- [ ] **Step 6: Update status and commit**

Mark `MM-ADM-001` and `MM-IMPORT-001` complete only when their acceptance evidence exists. Keep `HUB-ADM-001` and `HUB-IMPORT-001` in progress until extraction and reuse by a second SaaS prove the shared contract.

```powershell
git add frontend/src/mediamind/components/administration docs/CODEX_BACKLOG.md docs/CODEX_HANDOFF.md docs/PROJECT_STATUS.md
git commit -m "feat(admin): complete administration workspace"
```

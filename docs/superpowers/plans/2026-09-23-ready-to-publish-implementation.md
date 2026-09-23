# Ready to Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a etapa funcional `Para publicar`, com conferência, bloqueios, autorização e criação idempotente de trabalhos por canal.

**Architecture:** A preparação de publicação será um agregado próprio, separado do estágio da produção. FastAPI e SQLAlchemy serão a autoridade; React consumirá lista e detalhe agregados e apenas antecipará bloqueios. Chamadas externas ficam fora do request e serão simuladas por jobs persistidos no primeiro corte.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL/SQLite de teste, React 18, React Router, Tailwind, Vitest, Testing Library e pytest.

**Spec:** `docs/superpowers/specs/2026-09-23-ready-to-publish-design.md`

## Global Constraints

- Preservar `Finalizado`, Redes sociais, `Publicações`, Analytics, Workspace 1 e Workspace 2.
- O estado da produção continua `finalizado`; o estado de distribuição é independente.
- Toda consulta e mutação usa o tenant da sessão e permissão por ação.
- Nenhuma API externa de rede social é chamada no primeiro release.
- O botão iniciar cria registros/jobs idempotentes e retorna rapidamente.
- Nenhuma alteração vai ao Render sem suíte, build, homologação e rollback.

## Review Focus

- Dois inícios concorrentes da mesma preparação devem produzir um único grupo.
- Preparação pertencente a outro tenant deve retornar 404, sem revelar existência.
- Conta desconectada ou versão ausente deve bloquear o início mesmo que a UI esteja desatualizada.
- Horário com timezone futuro deve gerar `scheduled`; horário passado ou ausente deve gerar `queued`.
- Falha após commit e antes do enfileiramento deve deixar publicações recuperáveis, sem duplicação.

---

### Task 1: Persistir o agregado de preparação

**Files:**
- Create: `backend/app/models/publication.py`
- Create: `alembic/versions/0007_publication_preparations.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_publication_models.py`

**Interfaces:**
- Produces: `PublicationSchedule`, `PublicationScheduleTarget`, `PublicationCheckItem`, `PublicationGroup`, `Publication` e enumerações de estado.

- [ ] **Step 1: Write the failing model test**

```python
def test_schedule_rejects_duplicate_check_code(session, tenant, user):
    schedule = make_schedule(session, tenant.id, user.id)
    session.add_all([
        PublicationCheckItem(schedule_id=schedule.id, code="official_media", label="Versão oficial"),
        PublicationCheckItem(schedule_id=schedule.id, code="official_media", label="Versão oficial"),
    ])
    with pytest.raises(IntegrityError):
        session.commit()
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_publication_models.py -q`  
Expected: FAIL because the models and uniqueness constraint do not exist.

- [ ] **Step 3: Add minimal models and migration**

```python
class PublicationSchedule(Base):
    __tablename__ = "publication_schedules"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    production_id: Mapped[str] = mapped_column(String(120), index=True)
    media_asset_id: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(40), default="awaiting_review", index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(String(4000), default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
```

Add the remaining fields from the spec, tenant-scoped indexes, unique `(schedule_id, code)` and unique target identity. Migration `downgrade()` drops only these new tables in reverse dependency order.

- [ ] **Step 4: Run model and migration tests**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_publication_models.py tests\integration\test_database.py -q`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/models/publication.py backend/app/models/__init__.py alembic/versions/0007_publication_preparations.py backend/tests/test_publication_models.py
git commit -m "feat(publication): add preparation aggregate"
```

### Task 2: Implementar regras de conferência e início

**Files:**
- Create: `backend/app/services/publication_preparations.py`
- Test: `backend/tests/test_publication_preparation_service.py`

**Interfaces:**
- Consumes: modelos da Task 1.
- Produces: `evaluate_blockers(session, schedule) -> list[PreparationBlocker]`, `complete_review(...)` e `start_preparation(...) -> PublicationGroup`.

- [ ] **Step 1: Write failing domain tests**

```python
def test_start_creates_one_publication_per_target_once(session, ready_schedule, current):
    first = start_preparation(session, current, ready_schedule.id, "request-123")
    second = start_preparation(session, current, ready_schedule.id, "request-123")
    assert first.id == second.id
    assert len(first.publications) == len(ready_schedule.targets)

def test_disconnected_account_blocks_start(session, ready_schedule, current):
    ready_schedule.targets[0].account_status = "disconnected"
    with pytest.raises(PublicError) as error:
        start_preparation(session, current, ready_schedule.id, "request-456")
    assert error.value.code == "PUBLICATION_PREPARATION_BLOCKED"
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_publication_preparation_service.py -q`  
Expected: FAIL because service functions are missing.

- [ ] **Step 3: Implement minimal service**

```python
def start_preparation(session, current, schedule_id, idempotency_key):
    schedule = load_for_update(session, current.tenant_id, schedule_id)
    existing = find_group_by_key(session, current.tenant_id, idempotency_key)
    if existing:
        return existing
    blockers = evaluate_blockers(session, schedule)
    if schedule.status != "ready" or blockers:
        raise PublicError(409, "PUBLICATION_PREPARATION_BLOCKED", "A publicação possui pendências.")
    group = create_group_and_publications(session, current, schedule, idempotency_key)
    schedule.status = "started"
    add_publication_audit(session, current, "publication.started", schedule, group)
    session.commit()
    return group
```

Use horário UTC, timezone original, idempotência única por tenant e revalidação de arquivo, versão, checks e contas.

- [ ] **Step 4: Run service tests**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_publication_preparation_service.py -q`  
Expected: PASS, including concurrent/idempotent, cross-tenant and scheduled/queued cases.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/services/publication_preparations.py backend/tests/test_publication_preparation_service.py
git commit -m "feat(publication): enforce review and idempotent start"
```

### Task 3: Expor a API agregada

**Files:**
- Create: `backend/app/schemas/publication.py`
- Create: `backend/app/api/v1/publication_preparations.py`
- Modify: `backend/app/api/v1/__init__.py`
- Modify: `backend/app/tenancy/record_policies.py`
- Test: `backend/tests/test_publication_preparations_api.py`

**Interfaces:**
- Produces the endpoints defined in the spec and stable public errors.

- [ ] **Step 1: Write failing API tests**

```python
def test_detail_is_tenant_scoped(client, auth_headers, other_tenant_schedule):
    response = client.get(f"/api/v1/publication-preparations/{other_tenant_schedule.id}", headers=auth_headers)
    assert response.status_code == 404

def test_start_requires_idempotency_key(client, ready_schedule, auth_headers):
    response = client.post(f"/api/v1/publication-preparations/{ready_schedule.id}/start", headers=auth_headers)
    assert response.status_code == 400
    assert response.json()["error_code"] == "IDEMPOTENCY_KEY_REQUIRED"
```

- [ ] **Step 2: Run API tests and confirm RED**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_publication_preparations_api.py -q`  
Expected: FAIL with route not found.

- [ ] **Step 3: Add schemas and endpoints**

```python
@router.post("/{schedule_id}/start", response_model=StartPreparationResponse)
def start(schedule_id: UUID, current: Authenticated, session: DbSession,
          idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None):
    if not idempotency_key:
        raise PublicError(400, "IDEMPOTENCY_KEY_REQUIRED", "Informe a chave de idempotência.")
    require_permission(session, current, "publication.start")
    return serialize_started(start_preparation(session, current, schedule_id, idempotency_key))
```

The list response is paginated; the detail response returns schedule, production, media, version, targets, checks, blockers and effective permissions in one payload.

- [ ] **Step 4: Run API regression**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_publication_preparations_api.py backend\tests\test_permissions.py backend\tests\test_tenancy.py -q`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/schemas/publication.py backend/app/api/v1/publication_preparations.py backend/app/api/v1/__init__.py backend/app/tenancy/record_policies.py backend/tests/test_publication_preparations_api.py
git commit -m "feat(publication): expose preparation API"
```

### Task 4: Criar cliente HTTP e normalização de estado

**Files:**
- Create: `frontend/src/api/publicationPreparations.js`
- Create: `frontend/src/api/publicationPreparations.test.js`
- Create: `frontend/src/mediamind/lib/publicationPreparationViewModel.js`
- Create: `frontend/src/mediamind/lib/publicationPreparationViewModel.test.js`

**Interfaces:**
- Produces: `listPreparations(filters)`, `getPreparation(id)`, `updateCheck(...)`, `completeReview(id)` and `startPreparation(id, key)`.

- [ ] **Step 1: Write failing client/view-model tests**

```javascript
it('sends the idempotency key when starting', async () => {
  await startPreparation('schedule-1', 'attempt-1');
  expect(http.post).toHaveBeenCalledWith('/publication-preparations/schedule-1/start', undefined, {
    headers: { 'Idempotency-Key': 'attempt-1' },
  });
});

it('keeps backend blockers as the authority', () => {
  expect(buildPreparationState({ status: 'ready', blockers: [{ code: 'account' }] }).canStart).toBe(false);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd frontend; npm run test -- --run src/api/publicationPreparations.test.js src/mediamind/lib/publicationPreparationViewModel.test.js`  
Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement minimal client and view model**

```javascript
export function buildPreparationState(data) {
  const pendingRequired = data.checks?.some((item) => item.required && !item.completed);
  return { ...data, canStart: data.status === 'ready' && !pendingRequired && !(data.blockers?.length) };
}
```

- [ ] **Step 4: Run targeted tests**

Run: `cd frontend; npm run test -- --run src/api/publicationPreparations.test.js src/mediamind/lib/publicationPreparationViewModel.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/api/publicationPreparations.js frontend/src/api/publicationPreparations.test.js frontend/src/mediamind/lib/publicationPreparationViewModel.js frontend/src/mediamind/lib/publicationPreparationViewModel.test.js
git commit -m "feat(publication): add preparation client"
```

### Task 5: Construir a tela de lista e detalhe

**Files:**
- Create: `frontend/src/mediamind/components/corp/publishing/ReadyToPublishPage.jsx`
- Create: `frontend/src/mediamind/components/corp/publishing/PublicationPreparationList.jsx`
- Create: `frontend/src/mediamind/components/corp/publishing/PublicationPreparationDetail.jsx`
- Create: `frontend/src/mediamind/components/corp/publishing/PublicationChecklist.jsx`
- Create: `frontend/src/mediamind/components/corp/publishing/PublicationTargets.jsx`
- Create: `frontend/src/mediamind/components/corp/publishing/PublicationEditorialContent.jsx`
- Create: `frontend/src/mediamind/components/corp/publishing/StartPublicationButton.jsx`
- Test: `frontend/src/mediamind/components/corp/publishing/ReadyToPublishPage.test.jsx`

**Interfaces:**
- Consumes: Task 4 API and view model.
- Produces: `ReadyToPublishPage({ incomingMedia, onNavigate })`.

- [ ] **Step 1: Write failing journey tests**

```jsx
it('shows blockers and keeps start disabled', async () => {
  render(<ReadyToPublishPage />);
  await user.click(await screen.findByText('A trajetória do Preto na medicina'));
  expect(screen.getByText('Conta/perfil não validado')).toBeVisible();
  expect(screen.getByRole('button', { name: /iniciar publicação/i })).toBeDisabled();
});

it('starts only once on double click', async () => {
  render(<ReadyToPublishPage />);
  const button = await screen.findByRole('button', { name: /iniciar publicação/i });
  await Promise.all([user.click(button), user.click(button)]);
  expect(startPreparation).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd frontend; npm run test -- --run src/mediamind/components/corp/publishing/ReadyToPublishPage.test.jsx`  
Expected: FAIL because components are missing.

- [ ] **Step 3: Implement the reference layout**

Build the left queue and right detail, four detail tabs, checklist progress, targets, editorial content, operational data and sticky footer. Use buttons for rows, visible focus, `aria-live` for start progress and responsive single-column fallback.

```jsx
<StartPublicationButton
  disabled={!state.canStart || starting}
  onStart={() => handleStart(crypto.randomUUID())}
/>
```

- [ ] **Step 4: Run component tests and visual build**

Run: `cd frontend; npm run test -- --run src/mediamind/components/corp/publishing/ReadyToPublishPage.test.jsx; npm run lint; npm run typecheck; npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/mediamind/components/corp/publishing
git commit -m "feat(publication): add ready-to-publish workspace"
```

### Task 6: Integrar menu, perfis e handoff de mídia

**Files:**
- Modify: `frontend/src/mediamind/Shell.jsx`
- Modify: `frontend/src/mediamind/lib/roleSubtabs.js`
- Modify: `frontend/src/mediamind/components/corp/roles/ProdutoraPage.jsx`
- Modify: `frontend/src/mediamind/components/corp/roles/EditorVideoPage.jsx`
- Modify: `frontend/src/mediamind/components/corp/FinalizadoTimeline.jsx`
- Modify: `frontend/src/mediamind/lib/mediaHandoff.js`
- Test: `frontend/src/mediamind/lib/roleSubtabs.test.js`
- Test: `frontend/src/mediamind/lib/mediaHandoff.test.js`

**Interfaces:**
- Produces canonical navigation `finalizado → redes_sociais → para_publicar → publicacoes → analytics`.

- [ ] **Step 1: Extend failing navigation tests**

```javascript
expect(getActiveSubtabs('producer')).toContain('para_publicar');
expect(buildMediaHandoff(project, 'para_publicar', '00:00:00', '00:08:42'))
  .toMatchObject({ destination: 'para_publicar', sourceId: project.id });
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd frontend; npm run test -- --run src/mediamind/lib/roleSubtabs.test.js src/mediamind/lib/mediaHandoff.test.js`  
Expected: FAIL because the subtab/handoff is absent.

- [ ] **Step 3: Add menu and render target**

Add `Para publicar` between Redes sociais and Publicações in the common menu and permitted production profiles. Route incoming media to `ReadyToPublishPage`; change Finalizado's publication action to send the selected media to `para_publicar`, not directly to `publicacoes`.

- [ ] **Step 4: Run frontend suite**

Run: `cd frontend; npm run test -- --run; npm run lint; npm run typecheck; npm run build`  
Expected: all green.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/mediamind/Shell.jsx frontend/src/mediamind/lib/roleSubtabs.js frontend/src/mediamind/components/corp/roles/ProdutoraPage.jsx frontend/src/mediamind/components/corp/roles/EditorVideoPage.jsx frontend/src/mediamind/components/corp/FinalizadoTimeline.jsx frontend/src/mediamind/lib/mediaHandoff.js frontend/src/mediamind/lib/roleSubtabs.test.js frontend/src/mediamind/lib/mediaHandoff.test.js
git commit -m "feat(publication): connect ready-to-publish stage"
```

### Task 7: Seed demonstrativo, regressão e documentação

**Files:**
- Modify: `backend/app/services/demo_seed.py`
- Modify: `backend/tests/test_demo_seed.py`
- Modify: `docs/CODEX_BACKLOG.md`
- Modify: `docs/CODEX_HANDOFF.md`
- Modify: `docs/PROJECT_STATUS.md`

**Interfaces:**
- Produces a deterministic demonstration with awaiting, blocked and ready preparations.

- [ ] **Step 1: Write failing seed assertions**

```python
def test_demo_seed_creates_publication_preparation_states(session, demo_tenant):
    seed_demo_data(session, demo_tenant.id)
    states = set(session.scalars(select(PublicationSchedule.status)))
    assert {"awaiting_review", "blocked", "ready"} <= states
```

- [ ] **Step 2: Run and confirm RED**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_demo_seed.py -q`  
Expected: FAIL because no preparations are seeded.

- [ ] **Step 3: Add deterministic seed and update status docs**

Seed only when the tenant has no preparation records. Mark `MM-PUB-001` complete only after every command below succeeds and manual visual comparison is recorded.

- [ ] **Step 4: Run the complete gate**

Run: `.\.venv\Scripts\python.exe -m pytest -q`  
Run: `.\.venv\Scripts\python.exe -m ruff check backend tests`  
Run: `cd frontend; npm run test -- --run --coverage; npm run lint; npm run typecheck; npm run build`  
Expected: all pass; no new warning or failure is omitted.

- [ ] **Step 5: Manual QA before any deploy**

Verify with superadmin and restricted user: list/filter/detail, checklist, blockers, complete review, double-click start, cross-tenant denial, handoff to Publicações, responsive layout and comparison with the approved reference image.

- [ ] **Step 6: Commit**

```powershell
git add backend/app/services/demo_seed.py backend/tests/test_demo_seed.py docs/CODEX_BACKLOG.md docs/CODEX_HANDOFF.md docs/PROJECT_STATUS.md
git commit -m "test(publication): complete ready-to-publish gate"
```


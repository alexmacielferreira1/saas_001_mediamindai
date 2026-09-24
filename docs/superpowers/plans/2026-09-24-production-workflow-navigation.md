# Production Workflow and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um fluxo editorial único e operável de Rascunhos a Analytics, consolidar Pesquisa/Roteiro no Workspace 2 e simplificar a navegação sem apagar as telas antigas.

**Architecture:** Um catálogo puro em `productionWorkflow.js` será a única fonte de ordem, rótulos e transições. Componentes de fila consomem esse catálogo por meio de ações acessíveis e drag-and-drop, enquanto `producaoStore.js` continua como adaptador temporário de persistência. Navegação e Workspace 2 mudam sem remover rotas antigas.

**Tech Stack:** React 18, React Router, Vitest, Testing Library, Tailwind CSS, `@hello-pangea/dnd`/HTML Drag and Drop já presentes, Vite.

**Spec:** `docs/superpowers/specs/2026-09-24-production-workflow-navigation-design.md`

## Global Constraints

- Preservar produção e o Workspace original; nenhuma rota ou tela antiga será apagada nesta etapa.
- Não incluir secrets, não alterar Render/Neon e não fazer deploy sem autorização explícita.
- Fluxo canônico: `rascunho → agendamentos → gravacoes → para_editar → em_edicao → aguardando_aprovacao → em_aprovacao → finalizado → redes_sociais → para_publicar → publicado → analytics`.
- Analytics é somente leitura e recebe apenas conteúdo publicado.
- Drag-and-drop nunca será o único meio de mudar etapa.
- Estados antigos desconhecidos permanecem visíveis como `Revisar classificação`.
- O acesso demo não pode ser renderizado em produção.
- Preservar as alterações locais existentes; adicionar e commitar somente arquivos de cada tarefa.

## Review Focus

- Registro com etapa antiga ou desconhecida deve continuar visível e não avançar silenciosamente; coberto na Task 1.
- Tentativa de pular etapas ou mover além dos limites deve ser recusada; coberto na Task 1.
- Falha de persistência deve restaurar o cartão e informar o usuário; coberto na Task 3.
- Usuário que não é superadmin não pode ver Perfis; coberto na Task 5.
- `ENVIRONMENT=production` deve esconder todas as contas demo; coberto na Task 6.

---

### Task 1: Catálogo canônico do fluxo editorial

**Files:**
- Modify: `frontend/src/mediamind/lib/productionWorkflow.js`
- Modify: `frontend/src/mediamind/lib/productionWorkflow.test.js`

**Interfaces:**
- Consumes: objetos de projeto com `etapa`, `gravada`, `grav_status` e estados legados.
- Produces: `PRODUCTION_STAGES`, `normalizeProductionStage(stage)`, `resolveProjectProductionStage(project)`, `getAdjacentProductionStage(stage, direction)`, `getProductionTransition(stage, direction)` e `productionStageLabel(stage)`.

- [ ] **Step 1: Escrever testes falhando para ordem, aliases, limites e desconhecidos**

```js
expect(PRODUCTION_STAGE_ORDER).toEqual([
  'rascunho', 'agendamentos', 'gravacoes', 'para_editar', 'em_edicao',
  'aguardando_aprovacao', 'em_aprovacao', 'finalizado', 'redes_sociais',
  'para_publicar', 'publicado', 'analytics',
]);
expect(normalizeProductionStage('publicacoes')).toBe('publicado');
expect(normalizeProductionStage('estado_inventado')).toBe('revisar_classificacao');
expect(getProductionTransition('rascunho', -1)).toEqual({ ok: false, reason: 'first_stage' });
expect(getProductionTransition('rascunho', 2)).toEqual({ ok: false, reason: 'invalid_direction' });
expect(getProductionTransition('publicado', 1)).toEqual({ ok: true, from: 'publicado', to: 'analytics' });
expect(getProductionTransition('analytics', 1)).toEqual({ ok: false, reason: 'last_stage' });
```

- [ ] **Step 2: Rodar o teste e confirmar a falha**

Run: `npm --prefix frontend test -- --run src/mediamind/lib/productionWorkflow.test.js`

Expected: FAIL porque `getProductionTransition` não existe e os rótulos/aliases ainda divergem.

- [ ] **Step 3: Implementar o catálogo e a transição pura**

```js
const LEGACY_STAGE_ALIASES = {
  aguardando: 'aguardando_aprovacao',
  gravacao: 'gravacoes',
  publicacoes: 'publicado',
  para_publicar: 'para_publicar',
};

export function normalizeProductionStage(stage) {
  if (LEGACY_STAGE_ALIASES[stage]) return LEGACY_STAGE_ALIASES[stage];
  return PRODUCTION_STAGE_ORDER.includes(stage) ? stage : 'revisar_classificacao';
}

export function getProductionTransition(stage, direction) {
  if (direction !== -1 && direction !== 1) return { ok: false, reason: 'invalid_direction' };
  const from = normalizeProductionStage(stage);
  if (from === 'revisar_classificacao') return { ok: false, reason: 'unknown_stage' };
  const index = PRODUCTION_STAGE_ORDER.indexOf(from);
  const to = PRODUCTION_STAGE_ORDER[index + direction];
  if (!to) return { ok: false, reason: direction < 0 ? 'first_stage' : 'last_stage' };
  return { ok: true, from, to };
}
```

- [ ] **Step 4: Rodar os testes do catálogo**

Run: `npm --prefix frontend test -- --run src/mediamind/lib/productionWorkflow.test.js`

Expected: PASS.

- [ ] **Step 5: Commitar somente catálogo e testes**

```bash
git add frontend/src/mediamind/lib/productionWorkflow.js frontend/src/mediamind/lib/productionWorkflow.test.js
git commit -m "feat: define canonical production workflow"
```

### Task 2: Adaptador único de persistência e compatibilidade

**Files:**
- Modify: `frontend/src/mediamind/lib/producaoStore.js`
- Modify: `frontend/src/mediamind/lib/producaoStore.test.jsx`
- Modify: `frontend/src/mediamind/lib/edicaoWorkflow.js`
- Modify: `frontend/src/mediamind/lib/edicaoWorkflow.test.js`

**Interfaces:**
- Consumes: `getProductionTransition(stage, direction)` da Task 1.
- Produces: `moveProjeto(id, direction): Promise<{ok:boolean, project?:object, reason?:string}>` e mapeamento compatível de `edicao_status`.

- [ ] **Step 1: Escrever testes para avanço, retorno, erro e etapa desconhecida**

```jsx
const { result } = renderHook(() => useProducao(), { wrapper });
await act(async () => expect(await result.current.moveProjeto('p1', 1)).toMatchObject({ ok: true }));
expect(result.current.projetos.find((p) => p.id === 'p1').etapa).toBe('agendamentos');
await act(async () => expect(await result.current.moveProjeto('desconhecido', 1)).toEqual({ ok: false, reason: 'not_found' }));
```

- [ ] **Step 2: Rodar testes e confirmar falha**

Run: `npm --prefix frontend test -- --run src/mediamind/lib/producaoStore.test.jsx src/mediamind/lib/edicaoWorkflow.test.js`

Expected: FAIL porque o store ainda não retorna resultado estruturado em todas as transições.

- [ ] **Step 3: Implementar `moveProjeto` com atualização atômica e mapeamento de edição**

```js
async function moveProjeto(id, direction) {
  const current = projetos.find((project) => String(project.id) === String(id));
  if (!current) return { ok: false, reason: 'not_found' };
  const transition = getProductionTransition(resolveProjectProductionStage(current), direction);
  if (!transition.ok) return transition;
  const patch = { etapa: transition.to };
  if (transition.to === 'para_editar') patch.edicao_status = 'rascunho_corte';
  if (transition.to === 'em_edicao') patch.edicao_status = 'corte_fino';
  if (transition.to === 'aguardando_aprovacao') patch.edicao_status = 'pronto_para_aprovacao';
  const project = await updateProjeto(id, patch);
  return { ok: true, project };
}
```

- [ ] **Step 4: Rodar testes do store e edição**

Run: `npm --prefix frontend test -- --run src/mediamind/lib/producaoStore.test.jsx src/mediamind/lib/edicaoWorkflow.test.js`

Expected: PASS.

- [ ] **Step 5: Commitar o adaptador**

```bash
git add frontend/src/mediamind/lib/producaoStore.js frontend/src/mediamind/lib/producaoStore.test.jsx frontend/src/mediamind/lib/edicaoWorkflow.js frontend/src/mediamind/lib/edicaoWorkflow.test.js
git commit -m "feat: centralize production stage persistence"
```

### Task 3: Componente acessível para mover cartões

**Files:**
- Modify: `frontend/src/mediamind/components/corp/StageDragList.jsx`
- Create: `frontend/src/mediamind/components/corp/StageDragList.test.jsx`

**Interfaces:**
- Consumes: `getProductionTransition`, `productionStageLabel` e callback assíncrono `onMove(id, direction)`.
- Produces: `DraggableStageCard` com ações de botão e `StageDragArea` com rollback visual e `role="status"`.

- [ ] **Step 1: Escrever testes de botões, zonas, falha e teclado**

```jsx
const onMove = vi.fn().mockResolvedValue({ ok: false, reason: 'persistence_failed' });
render(<StageDragArea onMove={onMove}><DraggableStageCard id="p1" etapa="em_edicao">Projeto</DraggableStageCard></StageDragArea>);
await user.click(screen.getByRole('button', { name: 'Enviar para Aguardando aprovação' }));
expect(onMove).toHaveBeenCalledWith('p1', 1);
expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível mover');
expect(screen.getByRole('button', { name: 'Voltar para Material para editar' })).toBeEnabled();
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm --prefix frontend test -- --run src/mediamind/components/corp/StageDragList.test.jsx`

Expected: FAIL porque os botões acessíveis e o alerta não existem.

- [ ] **Step 3: Implementar ações equivalentes e feedback**

```jsx
async function requestMove(id, direction) {
  setMessage({ tone: 'status', text: 'Movendo conteúdo…' });
  const result = await onMove?.(id, direction);
  setMessage(result?.ok
    ? { tone: 'status', text: `Conteúdo enviado para ${productionStageLabel(result.project.etapa)}.` }
    : { tone: 'alert', text: 'Não foi possível mover. O conteúdo permaneceu na etapa anterior.' });
}
```

Renderizar em cada `DraggableStageCard` os botões `Voltar para …`, `Abrir detalhes` e `Enviar para …`, ocultando apenas ações sem destino válido.

- [ ] **Step 4: Rodar o teste do componente**

Run: `npm --prefix frontend test -- --run src/mediamind/components/corp/StageDragList.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commitar componente e testes**

```bash
git add frontend/src/mediamind/components/corp/StageDragList.jsx frontend/src/mediamind/components/corp/StageDragList.test.jsx
git commit -m "feat: add accessible production stage movement"
```

### Task 4: Aplicar o pipeline a todas as telas de produção

**Files:**
- Modify: `frontend/src/mediamind/components/corp/RascunhosPage.jsx`
- Modify: `frontend/src/mediamind/components/corp/roles/AgendamentosView.jsx`
- Modify: `frontend/src/mediamind/components/corp/GravacoesMateriais.jsx`
- Modify: `frontend/src/mediamind/components/corp/roles/EdicaoPage.jsx`
- Modify: `frontend/src/mediamind/components/corp/roles/AprovacoesPage.jsx`
- Modify: `frontend/src/mediamind/components/corp/FinalizadoTimeline.jsx`
- Modify: `frontend/src/mediamind/components/corp/SocialCortesWorkspace.jsx`
- Modify: `frontend/src/mediamind/components/corp/CorpPublications.jsx`
- Modify: `frontend/src/mediamind/components/corp/CorpAnalytics.jsx`
- Create: `frontend/src/mediamind/components/corp/ProductionPipeline.test.jsx`

**Interfaces:**
- Consumes: `moveProjeto`, `isProjectInProductionStage`, `StageDragArea` e `DraggableStageCard`.
- Produces: telas filtradas pelas 12 etapas, incluindo vistas distintas para `para_publicar` e `publicado`.

- [ ] **Step 1: Escrever teste integrado das etapas e rótulos**

```jsx
render(<ProductionHarness projects={projectsForEveryStage} />);
for (const label of ['Rascunhos', 'Agendamentos', 'Gravações', 'Material para editar', 'Em edição', 'Aguardando aprovação', 'Em aprovação', 'Finalizado', 'Redes sociais', 'Para publicação', 'Publicado', 'Analytics']) {
  expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
}
expect(screen.getByTestId('analytics-items')).not.toHaveTextContent('Não publicado');
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm --prefix frontend test -- --run src/mediamind/components/corp/ProductionPipeline.test.jsx`

Expected: FAIL nas etapas ainda ausentes ou combinadas.

- [ ] **Step 3: Atualizar cada tela para o filtro e transição canônicos**

Em cada componente, substituir comparações locais de `etapa` por:

```js
const items = projetos.filter((project) => isProjectInProductionStage(project, stageId));
const onMove = (id, direction) => moveProjeto(id, direction);
```

Em `CorpPublications.jsx`, renderizar duas visões pelo `sub`: `para_publicar` para fila operacional e `publicado` para histórico publicado. Em `CorpAnalytics.jsx`, filtrar exclusivamente `publicado`.

- [ ] **Step 4: Rodar testes integrados e testes existentes dessas telas**

Run: `npm --prefix frontend test -- --run src/mediamind/components/corp/ProductionPipeline.test.jsx src/mediamind/lib/productionWorkflow.test.js src/mediamind/lib/producaoStore.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commitar as telas do pipeline**

```bash
git add frontend/src/mediamind/components/corp frontend/src/mediamind/lib/productionWorkflow.js frontend/src/mediamind/lib/producaoStore.js
git commit -m "feat: connect production screens into editorial pipeline"
```

### Task 5: Simplificar menu e adicionar Perfis ao Início

**Files:**
- Modify: `frontend/src/mediamind/Shell.jsx`
- Create: `frontend/src/mediamind/Shell.test.jsx`
- Modify: `frontend/src/mediamind/pages/Home.jsx`
- Create: `frontend/src/mediamind/pages/Home.test.jsx`

**Interfaces:**
- Consumes: `useAuth().user.role`, React Router e subrotas existentes.
- Produces: menu operacional sem Pesquisa/Workspace/Roteiro/IAcervo Corp e botão `Perfis` exclusivo do superadmin.

- [ ] **Step 1: Escrever testes do menu e de autorização visual**

```jsx
renderShell({ role: 'superadmin' });
expect(screen.queryByRole('link', { name: 'IAcervo Corp' })).not.toBeInTheDocument();
expect(screen.queryByRole('link', { name: 'Pesquisa' })).not.toBeInTheDocument();
expect(screen.queryByRole('link', { name: 'Workspace' })).not.toBeInTheDocument();
expect(screen.queryByRole('link', { name: 'Modo roteiro' })).not.toBeInTheDocument();
expect(screen.getByRole('link', { name: 'Material para editar' })).toBeInTheDocument();

renderHome({ role: 'superadmin' });
expect(screen.getByRole('link', { name: 'Perfis' })).toHaveAttribute('href', '/corp');
renderHome({ role: 'editor' });
expect(screen.queryByRole('link', { name: 'Perfis' })).not.toBeInTheDocument();
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm --prefix frontend test -- --run src/mediamind/Shell.test.jsx src/mediamind/pages/Home.test.jsx`

Expected: FAIL com itens antigos ainda visíveis e Perfis ausente.

- [ ] **Step 3: Atualizar `NAV_GROUPS` e inserir o botão Perfis**

O grupo Produção deve usar exatamente os IDs do catálogo e rótulos da especificação. Em `Home.jsx`:

```jsx
{user?.role === 'superadmin' && (
  <Link to="/corp" className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300">
    <Users size={16} /> Perfis
  </Link>
)}
```

- [ ] **Step 4: Rodar testes de navegação**

Run: `npm --prefix frontend test -- --run src/mediamind/Shell.test.jsx src/mediamind/pages/Home.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commitar navegação e Perfis**

```bash
git add frontend/src/mediamind/Shell.jsx frontend/src/mediamind/Shell.test.jsx frontend/src/mediamind/pages/Home.jsx frontend/src/mediamind/pages/Home.test.jsx
git commit -m "feat: simplify navigation and expose profiles on home"
```

### Task 6: Garantir que contas demo nunca apareçam em produção

**Files:**
- Modify: `frontend/src/mediamind/lib/demoAccess.js`
- Modify: `frontend/src/mediamind/lib/demoAccess.test.js`
- Modify: `frontend/src/mediamind/pages/Login.jsx`
- Modify: `frontend/src/mediamind/pages/Login.test.jsx`

**Interfaces:**
- Consumes: `import.meta.env.PROD`, `import.meta.env.VITE_ENVIRONMENT`.
- Produces: `isDemoAccessEnabled(env): boolean` deny-by-default e renderização condicional completa.

- [ ] **Step 1: Escrever teste com produção, ausência de variável e local explícito**

```js
expect(isDemoAccessEnabled({ PROD: true, VITE_ENVIRONMENT: 'production' })).toBe(false);
expect(isDemoAccessEnabled({ PROD: false, VITE_ENVIRONMENT: undefined })).toBe(false);
expect(isDemoAccessEnabled({ PROD: false, VITE_ENVIRONMENT: 'local' })).toBe(true);
```

No teste da página, verificar que `Acesso rápido por papel` e todos os e-mails demo não existem em produção.

- [ ] **Step 2: Rodar e confirmar falha ou regressão atual**

Run: `npm --prefix frontend test -- --run src/mediamind/lib/demoAccess.test.js src/mediamind/pages/Login.test.jsx`

Expected: FAIL se qualquer fallback habilitar demo fora de `local`/`development` explícito.

- [ ] **Step 3: Implementar política deny-by-default e condicionar o bloco inteiro**

```js
export function isDemoAccessEnabled({ PROD, VITE_ENVIRONMENT }) {
  if (PROD) return false;
  return ['local', 'development'].includes(String(VITE_ENVIRONMENT || '').toLowerCase());
}
```

- [ ] **Step 4: Rodar testes de login**

Run: `npm --prefix frontend test -- --run src/mediamind/lib/demoAccess.test.js src/mediamind/pages/Login.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commitar proteção de produção**

```bash
git add frontend/src/mediamind/lib/demoAccess.js frontend/src/mediamind/lib/demoAccess.test.js frontend/src/mediamind/pages/Login.jsx frontend/src/mediamind/pages/Login.test.jsx
git commit -m "fix: hide demo accounts outside local development"
```

### Task 7: Consolidar Pesquisa e Roteiro no Workspace 2

**Files:**
- Modify: `frontend/src/mediamind/pages/Workspace2.jsx`
- Modify: `frontend/src/mediamind/pages/Workspace2.test.jsx`
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Search.jsx`
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Search.test.jsx`
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Script.jsx`
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Script.test.jsx`

**Interfaces:**
- Consumes: dados de acervo atuais, blocos de roteiro e estado do Workspace 2.
- Produces: etapas `search`, `script`, `timeline` como substitutas funcionais das entradas antigas de menu.

- [ ] **Step 1: Escrever testes de pesquisa, roteiro e preservação de estado**

```jsx
render(<MemoryRouter><Workspace2 /></MemoryRouter>);
await user.type(screen.getByRole('searchbox', { name: 'Pesquisar no acervo' }), 'mobilidade');
await user.click(screen.getByRole('button', { name: 'Adicionar ao roteiro' }));
await user.click(screen.getByRole('button', { name: 'Roteiro' }));
expect(screen.getByText('mobilidade urbana')).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Workspace antigo para conferência' })).toHaveAttribute('href', expect.stringContaining('sub=workspace'));
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm --prefix frontend test -- --run src/mediamind/pages/Workspace2.test.jsx src/mediamind/components/workspace2/Workspace2Search.test.jsx src/mediamind/components/workspace2/Workspace2Script.test.jsx`

Expected: FAIL nos controles/nomes ainda não consolidados.

- [ ] **Step 3: Integrar controles e links de conferência sem copiar telas antigas**

Manter `Workspace2Search` e `Workspace2Script` como componentes focados. `Workspace2.jsx` conserva seleção e blocos ao alternar etapas e apresenta links discretos para `sub=pesquisa`, `sub=workspace` e `sub=roteiro`, rotulados como referências antigas.

- [ ] **Step 4: Rodar testes do Workspace 2**

Run: `npm --prefix frontend test -- --run src/mediamind/pages/Workspace2.test.jsx src/mediamind/components/workspace2`

Expected: PASS.

- [ ] **Step 5: Commitar consolidação do Workspace 2**

```bash
git add frontend/src/mediamind/pages/Workspace2.jsx frontend/src/mediamind/pages/Workspace2.test.jsx frontend/src/mediamind/components/workspace2
git commit -m "feat: consolidate search and script in workspace two"
```

### Task 8: Normalizar UI, documentar e executar o gate final

**Files:**
- Modify: `frontend/src/mediamind/components/ui.jsx`
- Modify: componentes tocados nas Tasks 3–7 somente onde ainda houver classes divergentes.
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/CODEX_HANDOFF.md`
- Modify: `project-status.json`
- Create: `docs/QA_PRODUCTION_WORKFLOW_2026-09-24.md`

**Interfaces:**
- Consumes: todas as entregas anteriores.
- Produces: componentes visuais consistentes, evidência de testes e lista de pendências reais.

- [ ] **Step 1: Criar checklist de QA com as jornadas exatas**

Registrar em `docs/QA_PRODUCTION_WORKFLOW_2026-09-24.md`:

```markdown
- [ ] Superadmin vê Perfis no Início; editor não vê.
- [ ] Menu não mostra IAcervo Corp, Pesquisa, Workspace ou Modo roteiro.
- [ ] Cada etapa mostra somente seus próprios cartões.
- [ ] Botões anterior/próxima e drag nas bordas produzem o mesmo resultado.
- [ ] Primeira/última etapa não oferecem movimento inválido.
- [ ] Falha simulada mantém o cartão na origem e mostra erro.
- [ ] Redes sociais preserva listas internas antes de Para publicação.
- [ ] Analytics não mostra conteúdo não publicado.
- [ ] Produção não exibe contas demo.
- [ ] Workspace 2 pesquisa, adiciona ao roteiro e preserva estado.
```

- [ ] **Step 2: Padronizar primitives visuais já existentes**

Usar `rounded-xl` para painéis/cartões principais, `rounded-lg` para controles internos, foco `focus-visible:ring-2 focus-visible:ring-sky-400`, botões icon-only com `aria-label` e `title`, e estados vazios com título + orientação. Não alterar identidade, cores de marca ou densidade global.

- [ ] **Step 3: Executar testes e verificações frontend**

Run:

```bash
npm --prefix frontend test -- --run
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

Expected: todos com exit code 0. Falhas preexistentes não podem ser ocultadas; registrar separadamente se não forem causadas pelo conjunto.

- [ ] **Step 4: Fazer QA local no navegador em desktop e viewport móvel**

Validar todas as caixas do documento de QA, console sem novos erros, navegação por teclado e drop nas duas bordas. Não usar produção como ambiente de edição e não publicar.

- [ ] **Step 5: Atualizar estado e handoff com evidências reais**

Registrar comandos, contagens, falhas preexistentes, arquivos alterados, itens não concluídos e a proibição de deploy automático em `docs/PROJECT_STATUS.md`, `docs/CODEX_HANDOFF.md` e `project-status.json`.

- [ ] **Step 6: Commitar UI, documentação e evidências**

```bash
git add frontend/src/mediamind/components/ui.jsx frontend/src/mediamind docs/QA_PRODUCTION_WORKFLOW_2026-09-24.md docs/PROJECT_STATUS.md docs/CODEX_HANDOFF.md project-status.json
git commit -m "chore: verify production workflow experience"
```

- [ ] **Step 7: Revisar o diff completo antes de qualquer publicação**

Run: `git diff --check HEAD~8..HEAD && git status --short`

Expected: sem whitespace errors; alterações locais não relacionadas permanecem identificadas e não são incluídas em publicação sem revisão.

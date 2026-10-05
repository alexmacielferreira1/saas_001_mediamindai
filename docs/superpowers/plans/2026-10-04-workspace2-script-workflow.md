# Workspace 2 Script Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o Workspace 2 em Pesquisa → Roteiros → Criar → Roteiro → Timeline → Exportar, preservando o fluxo existente e concentrando player e detalhes no editor.

**Architecture:** `Workspace2` continua dono do estado compartilhado do projeto, mídias e blocos. Novas etapas focadas cuidam do catálogo e da criação, enquanto componentes menores compõem a biblioteca, o player e o roteiro; detalhes são expansões locais, não novas rotas.

**Tech Stack:** React 18, React Router, Tailwind CSS, Lucide React, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-04-workspace2-script-workflow-design.md`

## Global Constraints

- Preservar `project`, `blocks`, `assets`, `selectedIds`, `mediaSearch` e `previewAssetId` como estado compartilhado em `Workspace2`.
- Preservar compatibilidade com `mm_workspace2_draft`, `mm_workspace2_timeline2_draft` e o documento enviado à Timeline 2.
- Não criar persistência backend nem política definitiva `vN-1` nesta rodada.
- Não remover importação, exportação, upload, bloqueio, salvar, resetar, arrastar, reordenar ou adicionar texto.
- Detalhes devem abrir no mesmo contexto, sem navegação para outra tela.
- Não adicionar dependências frontend.

## Review Focus

- Acervo vazio ou indisponível: catálogo e criação continuam utilizáveis e mostram estado explícito — coberto nas Tasks 2 e 3.
- Troca de etapa com seleção existente: IDs e filtros não são reiniciados — coberto na Task 1.
- Mídia sem `stream_url`: preview mostra fallback, sem quebrar IN/OUT — coberto na Task 5.
- Roteiro sem blocos: editor mantém drop zone e permite adicionar texto/mídia — coberto na Task 6.
- Largura extrema ou preview desligado: roteiro permanece operável e não desaparece — coberto na Task 7.

---

### Task 1: Navegação canônica do Workspace 2

**Files:**
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Stepper.jsx`
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Stepper.test.jsx`
- Modify: `frontend/src/mediamind/pages/Workspace2.jsx`
- Modify: `frontend/src/mediamind/pages/Workspace2.test.jsx`

**Interfaces:**
- Consumes: `activeStep: string`, `onStepChange(step: string)` e estado compartilhado atual.
- Produces: etapas `search`, `scripts`, `create`, `script`, `timeline`, `export`.

- [ ] **Step 1: Escrever testes falhando para a sequência das seis etapas**

Adicionar testes `shows_search_scripts_create_script_timeline_export_in_order` e `keeps_media_selection_when_moving_between_steps`; afirmar rótulos, ordem e preservação da seleção/filtro.

- [ ] **Step 2: Rodar os testes direcionados e confirmar a falha pela ausência de Roteiros e Criar**

Run: `npm test -- --run src/mediamind/components/workspace2/Workspace2Stepper.test.jsx src/mediamind/pages/Workspace2.test.jsx`

- [ ] **Step 3: Implementar a sequência canônica e o roteamento interno em `Workspace2`**

Manter Timeline e Export; substituir a etapa Preview separada por `scripts` e `create`, sem reinicializar o estado ao trocar de etapa.

- [ ] **Step 4: Rodar os testes direcionados e confirmar aprovação**

Run: comando da Step 2. Expected: PASS.

### Task 2: Catálogo de roteiros existentes

**Files:**
- Create: `frontend/src/mediamind/components/workspace2/Workspace2Scripts.jsx`
- Create: `frontend/src/mediamind/components/workspace2/Workspace2Scripts.test.jsx`
- Modify: `frontend/src/mediamind/pages/Workspace2.jsx`

**Interfaces:**
- Consumes: `scripts`, `assets`, `selectedIds`, `mediaSearch`, `onMediaSearchChange`, `onPreview`, `onOpenScript`, `onCreate`.
- Produces: seleção de roteiro existente para `script` e ação novo roteiro para `create`.

- [ ] **Step 1: Escrever testes falhando para catálogo, filtros e destinos**

Cobrir `opens_existing_script_directly_in_editor`, `opens_new_script_creation`, busca/filtro, “Continuar de onde parou” e Acervo vazio explícito.

- [ ] **Step 2: Rodar o teste e confirmar falha por componente ausente**

Run: `npm test -- --run src/mediamind/components/workspace2/Workspace2Scripts.test.jsx`

- [ ] **Step 3: Implementar `Workspace2Scripts` reutilizando `MOCK_SCRIPTS` e modelos existentes**

Manter a pesquisa de mídia disponível em painel/drawer na etapa, sem duplicar estado nem dados.

- [ ] **Step 4: Integrar ao `Workspace2` e rodar testes direcionados**

Run: teste da Step 2 mais `src/mediamind/pages/Workspace2.test.jsx`. Expected: PASS.

### Task 3: Etapa Criar roteiro

**Files:**
- Create: `frontend/src/mediamind/components/workspace2/Workspace2Create.jsx`
- Create: `frontend/src/mediamind/components/workspace2/Workspace2Create.test.jsx`
- Modify: `frontend/src/mediamind/pages/Workspace2.jsx`

**Interfaces:**
- Consumes: `project`, `selectedAssets`, `onProjectChange`, `onApplyTemplate`, `onCreate`, `onPreview`.
- Produces: projeto inicial atualizado e blocos opcionais derivados da seleção, antes de `script`.

- [ ] **Step 1: Escrever testes falhando para os quatro pontos de partida**

Cobrir `blank`, `selected-media`, `brief` e `template`; afirmar que `selected-media` usa a seleção existente e que ausência de mídias mostra orientação sem falhar.

- [ ] **Step 2: Rodar o teste e confirmar falha por componente ausente**

Run: `npm test -- --run src/mediamind/components/workspace2/Workspace2Create.test.jsx`

- [ ] **Step 3: Implementar formulário inicial e ações de criação**

Reutilizar campos atuais do projeto e modelos `Reportagem`, `Entrevista` e `Cabeça + off + sonora`; não introduzir persistência nova.

- [ ] **Step 4: Integrar ao `Workspace2` e confirmar passagem para `script`**

Run: teste da Step 2 mais `src/mediamind/pages/Workspace2.test.jsx`. Expected: PASS.

### Task 4: Biblioteca unificada da coluna esquerda

**Files:**
- Create: `frontend/src/mediamind/components/workspace2/Workspace2Library.jsx`
- Create: `frontend/src/mediamind/components/workspace2/Workspace2Library.test.jsx`
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Script.jsx`

**Interfaces:**
- Consumes: mídias/seleção/filtros, `MOCK_SCRIPTS`, modelos, `onPreview`, `onAddAsset`, `onOpenScript`, `onApplyTemplate`.
- Produces: abas `archive`, `drafts`, `scripts`, `templates` e detalhe expansível por item.

- [ ] **Step 1: Escrever testes falhando para as quatro abas e detalhes no lugar**

Cobrir troca de aba, preservação de filtros, arrastar/adicionar mídia e `Detalhes` expandindo abaixo do item sem navegação.

- [ ] **Step 2: Rodar o teste e confirmar falha por componente ausente**

Run: `npm test -- --run src/mediamind/components/workspace2/Workspace2Library.test.jsx`

- [ ] **Step 3: Extrair a coluna esquerda existente para `Workspace2Library`**

Preservar todos os nomes acessíveis e payloads de drag-and-drop atuais.

- [ ] **Step 4: Rodar testes da biblioteca e regressão do roteiro**

Run: teste da Step 2 mais `src/mediamind/components/workspace2/Workspace2Script.test.jsx`. Expected: PASS.

### Task 5: Player central da mídia pesquisada

**Files:**
- Create: `frontend/src/mediamind/components/workspace2/Workspace2MediaPreview.jsx`
- Create: `frontend/src/mediamind/components/workspace2/Workspace2MediaPreview.test.jsx`
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Script.jsx`

**Interfaces:**
- Consumes: `asset`, `onAddAsset(asset, trim?)`, stream URL e duração.
- Produces: preview, `inPoint`, `outPoint`, duração selecionada e ação Adicionar ao roteiro.

- [ ] **Step 1: Escrever testes falhando para preview, IN/OUT e fallback**

Cobrir vídeo com stream, mídia sem stream, seleção de trecho válida e ação de adicionar usando a mídia atual.

- [ ] **Step 2: Rodar o teste e confirmar falha por componente ausente**

Run: `npm test -- --run src/mediamind/components/workspace2/Workspace2MediaPreview.test.jsx`

- [ ] **Step 3: Implementar o player reutilizando padrões de `Workspace2Timeline`**

Não modificar o contrato da Timeline; manter transcrição/informações contextuais no próprio player.

- [ ] **Step 4: Rodar testes direcionados do player e roteiro**

Run: teste da Step 2 mais `src/mediamind/components/workspace2/Workspace2Script.test.jsx`. Expected: PASS.

### Task 6: Roteiro à direita com informações e detalhes expansíveis

**Files:**
- Create: `frontend/src/mediamind/components/workspace2/Workspace2Outline.jsx`
- Create: `frontend/src/mediamind/components/workspace2/Workspace2Outline.test.jsx`
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Script.jsx`

**Interfaces:**
- Consumes: `project`, `blocks`, contadores, handlers de campos, texto, remoção, reordenação, save/export/timeline.
- Produces: painel recolhível de informações e lista editável com `Detalhes` exclusivos por bloco.

- [ ] **Step 1: Escrever testes falhando para painel e detalhes contextuais**

Cobrir recolher/expandir sem perder valores, somente um detalhe aberto, lista vazia operável, adicionar texto, remover e reordenar.

- [ ] **Step 2: Rodar o teste e confirmar falha por componente ausente**

Run: `npm test -- --run src/mediamind/components/workspace2/Workspace2Outline.test.jsx`

- [ ] **Step 3: Extrair cabeçalho, formulário e blocos para `Workspace2Outline`**

Detalhes de bloco expandem abaixo do item e exibem apenas dados disponíveis; manter os handlers existentes.

- [ ] **Step 4: Rodar testes do outline e regressão do roteiro**

Run: teste da Step 2 mais `src/mediamind/components/workspace2/Workspace2Script.test.jsx`. Expected: PASS.

### Task 7: Layout redimensionável e preview ocultável

**Files:**
- Create: `frontend/src/mediamind/components/workspace2/Workspace2EditorLayout.jsx`
- Create: `frontend/src/mediamind/components/workspace2/Workspace2EditorLayout.test.jsx`
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Script.jsx`
- Modify: `frontend/src/mediamind/pages/Workspace2.jsx`

**Interfaces:**
- Consumes: `library`, `preview`, `outline`, `showPreview`, `onTogglePreview`.
- Produces: `previewWidth` limitado entre 32% e 62%, divisor acessível e modo sem preview.

- [ ] **Step 1: Escrever testes falhando para alternância e limites de largura**

Cobrir ocultar/mostrar, roteiro ocupando centro+direita, divisor via teclado e clamp nos extremos.

- [ ] **Step 2: Rodar o teste e confirmar falha por componente ausente**

Run: `npm test -- --run src/mediamind/components/workspace2/Workspace2EditorLayout.test.jsx`

- [ ] **Step 3: Implementar layout CSS Grid e divisor sem dependência externa**

Persistir somente a preferência visual em `mm_workspace2_layout`; não misturar com o documento do projeto.

- [ ] **Step 4: Rodar testes de layout e roteiro**

Run: teste da Step 2 mais `src/mediamind/components/workspace2/Workspace2Script.test.jsx`. Expected: PASS.

### Task 8: Integração, regressão e documentação

**Files:**
- Modify: `frontend/src/mediamind/pages/Workspace2.integration-regression.test.jsx`
- Modify: `frontend/src/mediamind/pages/Workspace2.test.jsx`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/CODEX_HANDOFF.md`

**Interfaces:**
- Consumes: todas as interfaces produzidas nas Tasks 1–7.
- Produces: jornada integrada documentada e evidência reproduzível.

- [ ] **Step 1: Escrever/ajustar teste integrado falhando da jornada completa**

Pesquisa → seleção → Roteiros → Criar por mídia → Roteiro → detalhe → ocultar preview → Timeline; afirmar persistência das chaves locais e mesmo documento de timeline.

- [ ] **Step 2: Rodar o teste integrado e corrigir somente falhas de integração**

Run: `npm test -- --run src/mediamind/pages/Workspace2.integration-regression.test.jsx src/mediamind/pages/Workspace2.test.jsx`

- [ ] **Step 3: Executar gates completos do frontend**

Run: `npm test -- --run && npm run lint && npm run typecheck && npm run build`
Expected: todas as suítes aprovadas; avisos existentes documentados sem alegar homologação.

- [ ] **Step 4: Executar regressão backend proporcional**

Run: `.\.venv\Scripts\python.exe -m ruff check . && .\.venv\Scripts\python.exe -m ruff format --check . && .\.venv\Scripts\python.exe -m pytest -q`
Expected: gates verdes; nenhuma mudança de contrato backend nesta rodada.

- [ ] **Step 5: Montar a tela local no browser e validar visualmente**

Verificar 1440 px e largura reduzida: overflow, divisor, painel recolhível, detalhes, player, drag/drop e foco por teclado. Registrar discrepâncias e corrigir com testes quando comportamentais.

- [ ] **Step 6: Atualizar status e handoff**

Separar implementado, testado localmente, homologado e publicado; registrar que versões/backend continuam pendentes.

## Política de commits

Os passos de commit prescritos normalmente pela skill ficam suspensos porque o
usuário ainda não autorizou commits ou push. Após autorização, dividir em commits
pequenos por Task ou por grupo coerente, sem incluir alterações preexistentes não
relacionadas.

# Timeline 2 AI Edita Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma Timeline 2 funcional e isolada, ligada ao Workspace 2 e preservando todos os fluxos existentes.

**Architecture:** Um modelo puro e imutável concentra as operações de edição. Página e componentes consomem esse modelo, enquanto uma camada local persiste o projeto e mantém undo/redo.

**Tech Stack:** React 18, Vite, Vitest, Testing Library, Tailwind e lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-26-timeline2-ai-edita-foundation-design.md`

## Global Constraints

- Preservar Timeline e Workspace originais.
- Não executar nem incorporar binários do AI Edita.
- Não apresentar render, IA, transcrição ou publicação simulados como reais.
- Escrever teste falhando antes de cada comportamento novo.
- Não publicar nem alterar GitHub/Render/Neon.

## Review Focus

- Documento inválido no armazenamento deve cair para o padrão sem quebrar a tela.
- Operações em track bloqueada devem ser recusadas sem criar histórico.
- Split nas bordas deve ser no-op para evitar clipes abaixo de um frame.
- Conversão do Workspace 2 deve preservar todos os blocos e IDs de asset.
- Snapping desativado deve manter a posição exata solicitada.

---

### Task 1: Modelo funcional da Timeline 2

**Files:**
- Create: `frontend/src/mediamind/lib/timeline2Model.js`
- Create: `frontend/src/mediamind/lib/timeline2Model.test.js`

**Interfaces:**
- Produces: `createTimeline2Document`, `workspace2ToTimeline2`, `moveClip`, `trimClip`, `splitClip`, `deleteClips`, `setPlayhead`, `setZoom`, `toggleSnapping`.

- [ ] Escrever testes falhando para documento padrão, conversão, mover, trim, split, excluir, zoom e snapping.
- [ ] Executar o teste e confirmar falhas pela ausência das funções.
- [ ] Implementar as transformações puras mínimas.
- [ ] Executar o teste e confirmar aprovação.

### Task 2: Histórico e persistência local

**Files:**
- Create: `frontend/src/mediamind/hooks/useTimeline2Project.js`
- Create: `frontend/src/mediamind/hooks/useTimeline2Project.test.jsx`

**Interfaces:**
- Consumes: transformações da Task 1.
- Produces: hook com `document`, `dispatch`, `undo`, `redo`, `canUndo`, `canRedo`, `reset`.

- [ ] Escrever testes falhando para persistência, fallback inválido, undo/redo e limite de histórico.
- [ ] Confirmar falhas.
- [ ] Implementar o hook mínimo.
- [ ] Confirmar aprovação.

### Task 3: Página Timeline 2 com operações reais

**Files:**
- Create: `frontend/src/mediamind/pages/Timeline2.jsx`
- Create: `frontend/src/mediamind/pages/Timeline2.test.jsx`
- Create: `frontend/src/mediamind/components/timeline2/Timeline2Canvas.jsx`
- Create: `frontend/src/mediamind/components/timeline2/Timeline2Inspector.jsx`
- Create: `frontend/src/mediamind/components/timeline2/Timeline2Tracks.jsx`

**Interfaces:**
- Consumes: hook da Task 2.
- Produces: editor navegável com seleção, playhead, zoom, snapping, mover, trim, split, excluir e undo/redo.

- [ ] Escrever testes falhando para renderização e operações reais.
- [ ] Confirmar falhas.
- [ ] Implementar os componentes mínimos seguindo a identidade MediaMind.
- [ ] Confirmar aprovação.

### Task 4: Rota, menu vertical e integração com Workspace 2

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/mediamind/Shell.jsx`
- Modify: `frontend/src/mediamind/Shell.test.jsx`
- Modify: `frontend/src/mediamind/pages/Workspace2.jsx`
- Modify: `frontend/src/mediamind/pages/Workspace2.test.jsx`

**Interfaces:**
- Consumes: página e conversor das Tasks 1–3.
- Produces: `/timeline2`, item `Timeline 2` e passagem do rascunho do Workspace 2.

- [ ] Escrever testes falhando para menu, rota e envio do projeto.
- [ ] Confirmar falhas.
- [ ] Adicionar navegação e integração sem remover rotas existentes.
- [ ] Confirmar aprovação.

### Task 5: Validação e documentação de estado

**Files:**
- Modify: `docs/AI_EDITA_INVENTARIO_E_MATRIZ.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/CODEX_HANDOFF.md`
- Modify: `project-status.json` somente se os checks oficiais forem executados pelo script canônico.

- [ ] Executar testes direcionados e suíte frontend completa.
- [ ] Executar lint, typecheck e build.
- [ ] Registrar evidências reais, implementado e pendências.
- [ ] Verificar `git diff` e preservar arquivos não relacionados.


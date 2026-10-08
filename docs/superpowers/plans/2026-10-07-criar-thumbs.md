# Criar Thumbs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a página funcional Criar Thumbs no MediaMind principal com dados existentes, previews e exportação PNG.

**Architecture:** Um adaptador puro converte entidades existentes em um rascunho local. A página React coordena dados, quatro modos e duas superfícies de composição; um módulo de exportação captura cada superfície com `html2canvas`.

**Tech Stack:** React 18, Vite, Vitest, Testing Library, Tailwind CSS, html2canvas.

**Spec:** `docs/superpowers/specs/2026-10-07-criar-thumbs-design.md`

## Global Constraints

- Não criar nova tabela ou endpoint.
- Não alterar registros de origem ao editar a thumb.
- Não exibir dados fictícios como dados reais.
- Preservar rotas, navegação, autenticação e fluxos existentes.
- Exportar PNG real em 1920×1080 e 1080×1920.

## Review Focus

- Programa sem preset deve ficar explicitamente sem padrão.
- Projeto sem pessoa, roteiro ou imagem deve continuar editável.
- Alterar campos da thumb não pode mutar o projeto carregado.
- Falha de acervo deve produzir estado indisponível, sem dados inventados.
- Exportar ambos os formatos deve produzir dois downloads distintos.

---

### Task 1: Modelo e presets

**Files:** Create `frontend/src/mediamind/lib/thumbnailStudio.js`; Test `frontend/src/mediamind/lib/thumbnailStudio.test.js`

**Interfaces:** Produces `SIMERS_PRESETS`, `createThumbnailDraft`, `suggestHighlight`, `validateSimersDraft`.

- [ ] Escrever testes falhos para presets, normalização, imutabilidade e validação.
- [ ] Executar o teste e confirmar falha por módulo ausente.
- [ ] Implementar o modelo mínimo.
- [ ] Executar o teste e confirmar aprovação.

### Task 2: Página e navegação

**Files:** Create `frontend/src/mediamind/pages/ThumbnailStudio.jsx`; Create `frontend/src/mediamind/pages/ThumbnailStudio.test.jsx`; Modify `frontend/src/App.jsx`, `frontend/src/mediamind/Shell.jsx`, `frontend/src/mediamind/Shell.test.jsx`, `frontend/src/mediamind/lib/moduleAccess.js`.

**Interfaces:** Consumes Task 1; produces rota `/thumbnails` e interface acessível.

- [ ] Escrever testes falhos para guias, carga, edição local, formatos e guia do padrão.
- [ ] Executar e confirmar falhas esperadas.
- [ ] Implementar rota, permissão, menu e página.
- [ ] Executar testes direcionados até aprovarem.

### Task 3: Preview e exportação

**Files:** Create `frontend/src/mediamind/components/thumbnails/ThumbnailCanvas.jsx`; Create `frontend/src/mediamind/lib/thumbnailExport.js`; Create `frontend/src/mediamind/lib/thumbnailExport.test.js`; Modify `frontend/src/mediamind/pages/ThumbnailStudio.jsx`.

**Interfaces:** Produces `exportThumbnailElement(element, options)`.

- [ ] Escrever teste falho para escala, nome de arquivo e download.
- [ ] Implementar captura/exportação PNG e as duas composições próprias.
- [ ] Conectar download individual e combinado.
- [ ] Executar testes direcionados.

### Task 4: Verificação integrada

**Files:** Modify somente os arquivos anteriores se a verificação encontrar defeitos.

- [ ] Executar suíte frontend, lint, typecheck e build.
- [ ] Iniciar a aplicação e abrir `/thumbnails`.
- [ ] Verificar visualmente guias, responsividade, dados e previews.
- [ ] Corrigir regressões encontradas e repetir as provas afetadas.

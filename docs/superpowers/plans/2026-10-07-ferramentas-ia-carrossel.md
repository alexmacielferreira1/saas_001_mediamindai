# Ferramentas IA + Carrossel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a central Ferramentas IA com onze guias registradas, integrar a ferramenta de Thumbnails existente e concluir um fluxo persistente e exportável de Carrossel IA.

**Architecture:** A nova rota React usa um registro único das ferramentas e monta editores reais por guia. Documentos criativos e exports usam endpoints FastAPI próprios, persistidos como `TenantRecord` e validados por schemas específicos; o ZIP é criado no navegador a partir das superfícies renderizadas e armazenado pelo backend como export imutável da revisão.

**Tech Stack:** React 18, React Router 6, Vitest, Testing Library, html2canvas, fflate, FastAPI, Pydantic, SQLAlchemy, pytest.

**Spec:** `docs/superpowers/specs/2026-10-07-ferramentas-ia-design.md`

## Global Constraints

- Preservar integralmente as mudanças locais e a implementação não commitada de Thumbnails.
- Não alterar Render, Neon, GitHub, produção, secrets ou a tag `base44-export`.
- Não copiar código, prompts ou modelos proprietários de WiSkills.
- Uma guia indisponível não pode simular formulário, execução ou sucesso.
- Autorização de leitura e escrita deve ser aplicada no backend e isolada por tenant.
- O documento editável é a fonte do preview e do export; exports antigos não mudam após nova edição.
- Usar `production.write` para criação/edição, `review.write` para aprovação e exigir membership ativa para leitura/download.
- Não promover M0 nem reescrever o estado oficial fora do registro específico desta entrega.
- Seguir TDD: teste falho observado antes de cada alteração de produção.

## Review Focus

- Um usuário de outro tenant não pode ler documento nem baixar export, mesmo conhecendo o UUID.
- JSON inválido ou com tipo/campos desconhecidos deve preservar o documento atual e apontar o erro.
- Documento editado durante export deve produzir ZIP da revisão solicitada, não do rascunho mais recente.
- Projeto sem roteiro, transcrição ou imagens deve permitir carrossel independente sem inventar conteúdo.
- Fonte ausente, overflow ou falha no empacotamento deve impedir registro de export pronto.

---

### Task 1: Contrato puro do Carrossel

**Files:**
- Create: `frontend/src/mediamind/lib/carouselDocument.js`
- Create: `frontend/src/mediamind/lib/carouselDocument.test.js`

**Interfaces:**
- Produces: `CAROUSEL_SCHEMA_VERSION`, `createCarouselDocument(context)`, `parseCarouselImport(raw, current)`, `validateCarouselDocument(document)`, `reorderCarouselSlides(document, from, to)`, `carouselExportName(index, slide)`.
- Consumes: nenhum arquivo novo; recebe apenas objetos normalizados do frontend.

- [ ] **Step 1: Escrever testes falhos** para documento vazio independente, herança explícita de projeto, importação de capa/conteúdo/CTA, conversão de `*destaque*`, campos/tipos desconhecidos, JSON inválido sem mutação, aviso `3 de 8`, reordenação imutável e nomes `01-capa.png` estáveis.
- [ ] **Step 2: Executar** `npm test -- carouselDocument.test.js` em `frontend/` e confirmar falha por módulo ausente.
- [ ] **Step 3: Implementar** as seis exportações com schema `1`, IDs locais via `crypto.randomUUID()`, formatos aceitos `4:5`/`1:1` e tipos `cover`/`content`/`cta`.
- [ ] **Step 4: Reexecutar** o teste direcionado e confirmar aprovação.

### Task 2: API tenant-scoped de documentos criativos

**Files:**
- Create: `backend/app/schemas/creative_tools.py`
- Create: `backend/app/api/v1/creative_tools.py`
- Create: `backend/tests/test_creative_tools_api.py`
- Modify: `backend/app/api/v1/__init__.py`
- Modify: `backend/app/api/v1/records.py`
- Modify: `backend/app/tenancy/record_policies.py`

**Interfaces:**
- Produces: `POST/GET/PATCH /api/v1/creative-documents`, `GET /api/v1/creative-documents/{id}`, `POST /api/v1/creative-documents/{id}/approve`; entidades internas `CreativeDocument` e `CreativeExport`.
- Consumes: sessão atual, `TenantRecord`, `require_permission`, `add_audit` e contrato de Carrossel equivalente ao Task 1.

- [ ] **Step 1: Escrever testes falhos** cobrindo criação de carrossel schema 1, listagem filtrada por `tool_type`, patch que incrementa `revision`, rejeição de payload inválido, viewer sem escrita, ausência de `production.write`, aprovação sem `review.write`, auditoria server-side e isolamento entre tenants por UUID.
- [ ] **Step 2: Executar** `python -m pytest backend/tests/test_creative_tools_api.py -q` e confirmar 404/import ausente nos novos endpoints.
- [ ] **Step 3: Implementar schemas** `CreativeDocumentCreate`, `CreativeDocumentPatch`, `CreativeDocumentPublic`, `CreativeDocumentList` e validação discriminada para `tool_type='carousel'`.
- [ ] **Step 4: Implementar router** persistindo `CreativeDocument` em `TenantRecord`, usando `production.write`, revisão inicial `1`, incremento atômico por edição e aprovação imutável com `approved_revision`.
- [ ] **Step 5: Registrar router e políticas** adicionando os dois tipos permitidos sem alterar os demais contratos.
- [ ] **Step 6: Reexecutar** o teste direcionado e confirmar aprovação.

### Task 3: Export imutável armazenado no backend

**Files:**
- Modify: `backend/app/schemas/creative_tools.py`
- Modify: `backend/app/api/v1/creative_tools.py`
- Create: `backend/app/creative/__init__.py`
- Create: `backend/app/creative/storage.py`
- Modify: `backend/tests/test_creative_tools_api.py`

**Interfaces:**
- Produces: `POST /api/v1/creative-documents/{id}/exports` multipart (`revision`, `preset`, `file`), `GET /api/v1/creative-exports/{id}/download`; `store_creative_export(...) -> StoredCreativeExport`.
- Consumes: documento do Task 2 e diretório de storage configurado do produto.

- [ ] **Step 1: Acrescentar testes falhos** para ZIP válido, revisão inexistente, revisão alterada durante upload, checksum SHA-256, nome seguro, download autenticado, isolamento de tenant e falha de storage sem registro `ready`.
- [ ] **Step 2: Executar** o teste direcionado e confirmar 404 nos endpoints de export.
- [ ] **Step 3: Implementar storage** com escrita temporária, checksum, rename atômico e caminho relativo fora do nome fornecido pelo cliente.
- [ ] **Step 4: Implementar endpoints** exigindo `production.write` para criar e membership do mesmo tenant para baixar; registrar `CreativeExport` somente após armazenamento concluído.
- [ ] **Step 5: Reexecutar** o teste direcionado e confirmar aprovação.

### Task 4: Cliente frontend e persistência

**Files:**
- Create: `frontend/src/mediamind/lib/creativeToolsApi.js`
- Create: `frontend/src/mediamind/lib/creativeToolsApi.test.js`

**Interfaces:**
- Produces: `listCreativeDocuments(toolType)`, `createCreativeDocument(payload)`, `updateCreativeDocument(id, payload)`, `approveCreativeDocument(id)`, `uploadCreativeExport(id, revision, preset, blob)`, `creativeExportDownloadUrl(id)`.
- Consumes: `frontend/src/api/httpClient.js` e endpoints dos Tasks 2–3.

- [ ] **Step 1: Escrever testes falhos** para métodos/URLs/corpos, erro público preservado, `FormData` de export e URL de download sem token em query string.
- [ ] **Step 2: Executar** `npm test -- creativeToolsApi.test.js` e confirmar falha por módulo ausente.
- [ ] **Step 3: Implementar** o cliente sem fallback silencioso para localStorage quando a API autenticada falhar.
- [ ] **Step 4: Reexecutar** o teste direcionado e confirmar aprovação.

### Task 5: Central Ferramentas IA e navegação

**Files:**
- Create: `frontend/src/mediamind/lib/aiToolsRegistry.js`
- Create: `frontend/src/mediamind/lib/aiToolsRegistry.test.js`
- Create: `frontend/src/mediamind/pages/AITools.jsx`
- Create: `frontend/src/mediamind/pages/AITools.test.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/mediamind/Shell.jsx`
- Modify: `frontend/src/mediamind/Shell.test.jsx`
- Modify: `frontend/src/mediamind/lib/moduleAccess.js`
- Modify: `frontend/src/mediamind/lib/moduleAccess.test.js`

**Interfaces:**
- Produces: `AI_TOOLS`, `getAITool(id)`, rota `/ferramentas-ia`, módulo `ai_tools` e seleção via `?tool=<id>`.
- Consumes: rota `/thumbnails` já existente e `CarouselStudio` do Task 6.

- [ ] **Step 1: Escrever testes falhos** para exatamente onze guias/IDs, permissão de superadmin, navegação, contexto `project_id`, link funcional de Thumbnails e nove estados indisponíveis sem botões de execução.
- [ ] **Step 2: Executar** os testes direcionados e confirmar falhas por registro/página ausentes.
- [ ] **Step 3: Implementar registro e página** mantendo o padrão visual do Shell; Carrossel monta editor real, Thumbnails navega para a ferramenta existente e demais guias mostram somente escopo/estado indisponível.
- [ ] **Step 4: Conectar rota, menu e módulo** sem remover `/thumbnails` nem alterar papéis preexistentes.
- [ ] **Step 5: Reexecutar** os testes direcionados e confirmar aprovação.

### Task 6: Editor persistente de Carrossel

**Files:**
- Create: `frontend/src/mediamind/components/carousel/CarouselStudio.jsx`
- Create: `frontend/src/mediamind/components/carousel/CarouselStudio.test.jsx`
- Create: `frontend/src/mediamind/components/carousel/CarouselSlideCanvas.jsx`
- Modify: `frontend/src/mediamind/pages/AITools.jsx`

**Interfaces:**
- Produces: `CarouselStudio({ projectId })`, superfícies DOM identificadas por `data-carousel-slide-id`.
- Consumes: Tasks 1 e 4, `useProducaoProjetos()` e dados reais disponíveis do projeto.

- [ ] **Step 1: Escrever testes falhos** para estado independente, projeto ausente, carregamento/listagem, criação, salvamento, reload, importação válida/inválida, aviso `3 de 8`, inserir/remover/reordenar, legenda/hashtags, 4:5/1:1, aprovação negada e preservação do rascunho quando API falhar.
- [ ] **Step 2: Executar** `npm test -- CarouselStudio.test.jsx` e confirmar falha por componente ausente.
- [ ] **Step 3: Implementar editor** com autosave explícito por botão, indicação de origem, status e erros; nenhuma falha de API vira sucesso local.
- [ ] **Step 4: Implementar canvas** com templates institucionais mínimos, contagem/overflow visível e destaque estruturado.
- [ ] **Step 5: Reexecutar** os testes direcionados e confirmar aprovação.

### Task 7: PNGs, ZIP e registro do export

**Files:**
- Create: `frontend/src/mediamind/lib/carouselExport.js`
- Create: `frontend/src/mediamind/lib/carouselExport.test.js`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/mediamind/components/carousel/CarouselStudio.jsx`
- Modify: `frontend/src/mediamind/components/carousel/CarouselStudio.test.jsx`

**Interfaces:**
- Produces: `captureCarouselSlides(elements, document)`, `buildCarouselZip(files, document) -> Blob`.
- Consumes: `html2canvas`, dependência direta `fflate`, nomes do Task 1 e upload do Task 4.

- [ ] **Step 1: Escrever testes falhos** para dimensões 1080×1350/1080×1080, ordem dos PNGs, `legenda.txt`, `manifest.json`, schema/revisão no manifesto, erro de captura e ausência de upload quando empacotamento falhar.
- [ ] **Step 2: Executar** os testes de export/editor e confirmar falha por módulo ausente.
- [ ] **Step 3: Adicionar `fflate` como dependência direta** usando o lockfile atual, sem atualizar pacotes não relacionados.
- [ ] **Step 4: Implementar captura e ZIP** a partir do snapshot do documento salvo e da revisão retornada pela API.
- [ ] **Step 5: Conectar exportação**: validar overflow, gerar Blob, enviar ao backend, baixar pela URL autenticada e mostrar checksum/estado real.
- [ ] **Step 6: Reexecutar** os testes direcionados e confirmar aprovação.

### Task 8: Integração, documentação e validação local

**Files:**
- Modify: `docs/CODEX_BACKLOG.md`
- Modify: `docs/CODEX_HANDOFF.md`
- Modify: `docs/PROJECT_STATUS.md` somente na seção desta entrega, sem mudar o estado M0.
- Modify: arquivos anteriores apenas se a verificação revelar defeitos.

**Interfaces:**
- Consumes: todos os Tasks 1–7.
- Produces: registro implementado/testado/pendente e evidência reprodutível.

- [ ] **Step 1: Executar backend direcionado** `python -m pytest backend/tests/test_creative_tools_api.py -q`.
- [ ] **Step 2: Executar backend completo** `python -m pytest backend/tests -q` e registrar falhas preexistentes separadamente.
- [ ] **Step 3: Executar frontend completo** em `frontend/`: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- [ ] **Step 4: Iniciar/reutilizar ambiente local** pelos scripts oficiais sem parar a porta 8001 nem limpar volumes.
- [ ] **Step 5: Validar no navegador com login superadmin** em `http://127.0.0.1:5173/`: abrir central, conferir onze guias, acessar Thumbnails, criar/importar/salvar/reabrir/aprovar/exportar Carrossel e verificar download.
- [ ] **Step 6: Validar autorização** com perfil sem permissão usando conta local já provisionada, sem criar bypass.
- [ ] **Step 7: Atualizar documentação** com arquivos alterados, comandos/resultados, pendências das outras nove ferramentas e rollback local; não declarar M0 aprovado.

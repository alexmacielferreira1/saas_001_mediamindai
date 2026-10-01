# MediaMind MVP Incremental Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o percurso MVP real de perfil aditivo, upload, acervo/player, projeto/timeline, edição, exportação persistida e Finalizado.

**Architecture:** Preservar a UI e as rotas atuais, trocar somente as fontes críticas do percurso por serviços FastAPI/PostgreSQL tenant-scoped e introduzir uma interface de storage implementada localmente. Usar `TenantRecord` para projetos/estado/derivados nesta fatia, com versão otimista e auditoria existentes.

**Tech Stack:** React 18, Vite/Vitest, FastAPI, Pydantic, SQLAlchemy 2, Alembic, PostgreSQL 16, pytest, filesystem local, FFmpeg.

**Spec:** `docs/superpowers/specs/2026-09-29-mvp-incremental-design.md`

## Global Constraints

- Não migrar usuários ou perfis atuais automaticamente.
- Não redesenhar nem remover telas, rotas, dados ou compatibilidades fora do percurso.
- Não usar Base44, mocks, modo demo ou armazenamento do navegador como fonte de verdade no percurso MVP.
- Não implementar R2; somente manter o contrato de storage substituível.
- Não publicar nem alterar Render/Neon.
- Manter `M0 — failed` enquanto qualquer gate registrado continuar falhando.
- Toda alteração de comportamento começa por teste que falha pelo motivo esperado.

## Review Focus

- Vínculo `mvp` sem grupo de permissões não deve ganhar escrita por causa do perfil visual.
- Asset de outro tenant não pode ser listado, reproduzido, vinculado ou exportado.
- Upload interrompido ou banco falhando não pode deixar arquivo/registro órfão.
- Atualização concorrente de projeto precisa retornar conflito sem sobrescrever a versão nova.
- Exportação falha não pode criar item Finalizado; exportação concluída precisa sobreviver a reload.

---

### Task 1: Perfil MVP aditivo e navegação coerente

**Files:**
- Modify: `backend/app/demo_accounts.py`
- Modify: `backend/app/api/v1/memberships.py`
- Modify: `frontend/src/mediamind/lib/roleCatalog.js`
- Modify: `frontend/src/mediamind/lib/roleSubtabs.js`
- Modify: `frontend/src/mediamind/lib/permissions.js`
- Modify: `frontend/src/mediamind/Shell.jsx`
- Modify: `frontend/src/mediamind/pages/Corp.jsx`
- Test: `backend/tests/test_permission_groups_api.py`
- Test: `frontend/src/mediamind/lib/roleCatalog.test.js`
- Test: `frontend/src/mediamind/lib/roleSubtabs.test.js`
- Test: `frontend/src/mediamind/Shell.test.jsx`
- Test: `frontend/src/mediamind/pages/Corp.test.jsx`

**Interfaces:**
- Produces: papel `mvp`; `MVP_SUBTABS`; filtragem compartilhada de itens laterais/deep links.

- [ ] Escrever testes que provem atribuição explícita de `mvp`, nenhuma migração de papéis atuais, seleção das seis superfícies existentes e recusa de deep link fora da seleção.
- [ ] Executar os testes e confirmar falha por ausência do perfil/filtro.
- [ ] Acrescentar `mvp` aos catálogos; manter permissões em grupo separadas; derivar sidebar e destino de deep link da mesma seleção efetiva.
- [ ] Executar testes direcionados e suítes completas backend/frontend.
- [ ] Registrar diff e evidência do incremento.

### Task 2: Contrato substituível de storage e upload nativo enriquecido

**Files:**
- Create: `backend/app/media/storage_backend.py`
- Modify: `backend/app/media/storage.py`
- Modify: `backend/app/api/v1/media.py`
- Modify: `backend/app/media/assets.py`
- Modify: `frontend/src/api/media.js`
- Create: `frontend/src/mediamind/lib/mediaUpload.js`
- Test: `backend/tests/test_media_api.py`
- Test: `frontend/src/api/media.test.js`
- Test: `frontend/src/mediamind/lib/mediaUpload.test.js`

**Interfaces:**
- Produces: `MediaStorage` (`save_original`, `resolve_local`, `delete_asset`, `save_derived`); `uploadMediaAsset(file, metadata)` com `origin`, `project_id` e `recording_id` opcionais.

- [ ] Escrever testes para metadados aditivos, limite/tipo, rollback de arquivo e ausência de vazamento entre tenants.
- [ ] Confirmar falhas pelos contratos inexistentes.
- [ ] Extrair a interface e adaptar `LocalMediaStorage`; receber metadados multipart validados e serializá-los no Asset.
- [ ] Validar upload/stream Range direcionados e suíte backend/frontend.
- [ ] Registrar diff e evidência do incremento.

### Task 3: Gravações, Workspace e Timeline no upload único

**Files:**
- Modify: `frontend/src/mediamind/components/corp/GravacoesMateriais.jsx`
- Modify: `frontend/src/mediamind/lib/gravacoesUpload.js`
- Modify: `frontend/src/mediamind/pages/Workspace2.jsx`
- Modify: `frontend/src/mediamind/pages/Timeline2.jsx`
- Modify: `frontend/src/mediamind/components/corp/roles/EdicaoPage.jsx`
- Test: corresponding existing `.test.jsx` files

**Interfaces:**
- Consumes: `uploadMediaAsset(file, metadata)` da Task 2.
- Produces: material de gravação referenciado por `asset_id`/`stream_url`, sem `UploadPublicFile` no percurso MVP.

- [ ] Escrever testes de upload parcial, progresso/erro, vínculo com gravação/projeto e reprodução pelo stream persistido.
- [ ] Confirmar falha porque Gravações ainda usa Base44.
- [ ] Substituir os adaptadores do percurso pelo serviço único sem alterar a composição visual.
- [ ] Executar testes direcionados, frontend completo, lint e build.
- [ ] Registrar diff e evidência do incremento.

### Task 4: Acervo e player reais

**Files:**
- Modify: `frontend/src/mediamind/pages/Acervo.jsx`
- Create: `frontend/src/mediamind/components/media/AuthenticatedMediaPlayer.jsx`
- Test: `frontend/src/mediamind/pages/Acervo.test.jsx`
- Test: `frontend/src/mediamind/components/media/AuthenticatedMediaPlayer.test.jsx`
- Test: `backend/tests/test_media_api.py`

**Interfaces:**
- Consumes: catálogo/stream autenticado das Tasks 2–3.
- Produces: listagem nativa, estados loading/empty/error/denied e player compartilhado.

- [ ] Escrever testes sem fallback demo/Base44, busca/tipo, abertura, Range 206/416 e negação cross-tenant.
- [ ] Confirmar falhas na fonte atual do Acervo.
- [ ] Conectar somente a aba de arquivos ao catálogo nativo e usar o player compartilhado; preservar abas administrativas compatíveis.
- [ ] Executar testes direcionados e suítes completas.
- [ ] Registrar diff e evidência do incremento.

### Task 5: Persistência versionada do Workspace 2 e Timeline 2

**Files:**
- Modify: `backend/app/api/v1/records.py`
- Modify: `backend/app/tenancy/record_policies.py`
- Create: `frontend/src/api/projects.js`
- Modify: `frontend/src/mediamind/pages/Workspace2.jsx`
- Modify: `frontend/src/mediamind/hooks/useTimeline2Project.js`
- Test: `backend/tests/test_records_api.py`
- Test: `frontend/src/api/projects.test.js`
- Test: `frontend/src/mediamind/pages/Workspace2.test.jsx`
- Test: `frontend/src/mediamind/hooks/useTimeline2Project.test.jsx`

**Interfaces:**
- Produces: tipo `MediaProject`; `createProject`, `getProject`, `updateProject(id, expectedVersion, document)`; conflito HTTP 409.

- [ ] Escrever testes de create/reopen/update, versão concorrente, tenant e permissão.
- [ ] Confirmar falha por ausência de `MediaProject` e versionamento.
- [ ] Persistir projeto/roteiro/seleção/tracks/IN/OUT no backend; manter storage local apenas como recuperação explícita.
- [ ] Validar reabertura com nova instância do cliente e suítes completas.
- [ ] Registrar diff e evidência do incremento.

### Task 6: Estados reais, exportação catalogada e Finalizado

**Files:**
- Modify: `backend/app/api/v1/media.py`
- Modify: `backend/app/api/v1/records.py`
- Create: `frontend/src/api/workflow.js`
- Modify: `frontend/src/mediamind/lib/producaoStore.js`
- Modify: `frontend/src/mediamind/components/workspace2/Workspace2Export.jsx`
- Modify: `frontend/src/mediamind/components/corp/roles/EdicaoPage.jsx`
- Modify: `frontend/src/mediamind/components/corp/FinalizadoTimeline.jsx`
- Test: `backend/tests/test_media_api.py`
- Test: `backend/tests/test_records_api.py`
- Test: corresponding frontend tests

**Interfaces:**
- Produces: transição autorizada/atômica; exportação cria Asset derivado com `source_asset_ids`, `project_id`, `origin=export`, `media_status=ready`.

- [ ] Escrever testes para transições adjacentes, negação, falha de render sem derivado, sucesso com derivado e recuperação em Finalizado.
- [ ] Confirmar falhas porque workflow silencia erros e exportação retorna somente download.
- [ ] Persistir transições/auditoria e registrar o arquivo exportado via storage antes de retornar download/metadata.
- [ ] Conectar Edição e Finalizado ao backend preservando filas e layout.
- [ ] Executar testes direcionados e suítes completas.
- [ ] Registrar diff e evidência do incremento.

### Task 7: Integração PostgreSQL e percurso manual real

**Files:**
- Modify: `backend/tests/test_media_api.py`
- Modify: `tests/integration/test_database.py`
- Create: `tests/integration/test_mvp_journey.py`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `project-status.json`

**Interfaces:**
- Consumes: todos os contratos anteriores.
- Produces: evidência do percurso real sem reclassificar gates não resolvidos.

- [ ] Subir PostgreSQL local, aplicar migrations e criar contas/vínculos de teste sem alterar usuários existentes.
- [ ] Executar teste de integração com vídeo real: upload → lista → Range → projeto/timeline → export → transição → Finalizado → nova sessão.
- [ ] Executar casos negativos: sem permissão, outro tenant, arquivo inválido, conflito e render falho.
- [ ] Executar `scripts/test.ps1`, `scripts/check.ps1`, frontend lint/typecheck/test/build e smoke; registrar cada falha nominalmente.
- [ ] Fazer revisão do diff e atualizar estado/documentação apenas com evidência fresca.

## Self-review

- Cobertura: as seis etapas do documento aprovado estão mapeadas nas Tasks 1–7.
- Limite: R2, filas assíncronas, proxy, IA, publicação e analytics permanecem fora deste plano.
- Tipos: `Asset` continua nativo; `MediaProject` é o único novo tipo lógico; derivados continuam `Asset`.
- Riscos principais possuem teste explícito nas Tasks 1, 2, 5 e 6.
- A homologação PostgreSQL/manual permanece um gate separado e não é inferida das suítes unitárias.

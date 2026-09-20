# MediaMind Local Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar sessão local, empresa, membership e RBAC persistentes, preservando o layout e removendo Base44 da primeira jornada vertical.

**Architecture:** React usa clientes HTTP explícitos e cookie de sessão; FastAPI valida a sessão e resolve tenant/permissões; PostgreSQL guarda identidade e memberships. O export Base44 permanece como referência, não como runtime.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, React 18, Vite, pytest e Vitest.

**Spec:** `docs/REBUILD_DESIGN.md`

## Global Constraints

- Não alterar layout, rotas ou vocabulário visual sem evidência de defeito.
- Não versionar senha, token ou segredo.
- Não confiar em `tenant_id` enviado pelo navegador sem validar membership.
- Não criar pacote compartilhado nesta fase.
- MediaMind deve iniciar e autenticar com a Central desligada.
- Todo código de comportamento novo segue red-green-refactor.

## Review Focus

- Cookie ausente, expirado ou revogado retorna 401 estruturado e limpa a sessão do frontend.
- Usuário sem membership não acessa dados de empresa, mesmo forjando o ID.
- Troca de empresa aceita apenas memberships ativas.
- Reinício da API preserva sessão e dados válidos no PostgreSQL.
- Central indisponível não interfere no login nem na seleção de empresa.

---

### Task 1: Ferramentas de teste do frontend

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/src/test/setup.js`
- Create: `frontend/src/api/httpClient.test.js`

**Interfaces:**
- Produces: ambiente Vitest/jsdom e comando `npm test`.

- [ ] Adicionar Vitest, jsdom e Testing Library como dependências de desenvolvimento, sem trocar dependências de UI.
- [ ] Configurar `test` e `test:watch` no package e setup que limpa storage/fetch mocks.
- [ ] Escrever teste que espera `request('/session')` enviar credenciais, aceitar JSON e converter envelope de erro em `ApiError`.
- [ ] Rodar o teste e confirmar falha por módulo ausente.
- [ ] Implementar somente `httpClient.js` com base URL `/api/v1`, `credentials: 'include'`, cabeçalho de correlação opcional e `ApiError`.
- [ ] Rodar teste, lint, typecheck e build.

### Task 2: Modelo local de identidade e sessão

**Files:**
- Create: `backend/app/models/identity.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/app/security/passwords.py`
- Create: `backend/app/security/sessions.py`
- Create: `backend/tests/test_identity.py`
- Create: `alembic/versions/0002_identity_tenancy.py`

**Interfaces:**
- Produces: `User`, `Tenant`, `Membership`, `Session`; `hash_password`, `verify_password`, `new_session_token`, `hash_session_token`.

- [ ] Escrever testes que provam hash sem texto puro, verificação correta/incorreta, token aleatório e hash determinístico do token.
- [ ] Rodar os testes e observar falha por símbolos ausentes.
- [ ] Implementar as funções mínimas usando biblioteca de hash de senha mantida e `secrets.token_urlsafe`/SHA-256 para token opaco.
- [ ] Escrever teste de banco para unicidade de email normalizado, membership por tenant e expiração/revogação da sessão.
- [ ] Criar migration aditiva com UUIDs, timestamps UTC, índices e FKs; downgrade remove apenas as tabelas desta revisão.
- [ ] Rodar migration em banco descartável, testes unitários e de integração.

### Task 3: API de login, sessão e logout

**Files:**
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/repositories/identity.py`
- Create: `backend/app/services/auth.py`
- Create: `backend/app/api/v1/auth.py`
- Create: `backend/app/api/v1/__init__.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_auth_api.py`

**Interfaces:**
- Produces: `POST /api/v1/auth/login`, `GET /api/v1/auth/session`, `POST /api/v1/auth/logout`.
- Session response: usuário e memberships ativas, sem hash nem token.

- [ ] Escrever testes para credencial válida, inválida, usuário inativo, sessão válida, expirada e logout idempotente.
- [ ] Confirmar falhas 404/ausência de rotas.
- [ ] Implementar repository/service e cookie `HttpOnly`, `SameSite=Lax`, path `/`; `Secure` é configurável por ambiente.
- [ ] Usar comparação segura e resposta pública genérica para credenciais inválidas.
- [ ] Rodar arquivo de teste e depois toda a suíte backend.

### Task 4: Contexto de tenant e autorização

**Files:**
- Create: `backend/app/tenancy/context.py`
- Create: `backend/app/security/authorization.py`
- Create: `backend/app/api/v1/tenants.py`
- Create: `backend/tests/test_tenancy.py`

**Interfaces:**
- Produces: `get_current_session`, `require_membership`, `require_role`; `GET /api/v1/tenants`; `PUT /api/v1/auth/session/tenant`.

- [ ] Escrever testes de permitido, negado, tenant forjado, membership inativa e troca válida.
- [ ] Confirmar que os testes falham pela ausência das dependências/rotas.
- [ ] Implementar resolução exclusivamente pela sessão e banco.
- [ ] Registrar tenant/user/correlation no contexto de request sem logar dados sensíveis.
- [ ] Rodar testes e suíte completa.

### Task 5: Cliente e contexto de autenticação React

**Files:**
- Create: `frontend/src/api/auth.js`
- Rewrite: `frontend/src/lib/AuthContext.jsx`
- Rewrite: `frontend/src/mediamind/auth.jsx`
- Modify: `frontend/src/mediamind/pages/Login.jsx`
- Create: `frontend/src/lib/AuthContext.test.jsx`

**Interfaces:**
- Consumes: endpoints das Tasks 3–4.
- Produces: contrato existente `useAuth()` com `user`, `loading`, `login`, `logout`, `hasScreenAccess` e memberships.

- [ ] Escrever testes para bootstrap de sessão, login, erro público, logout, refresh e troca de empresa.
- [ ] Confirmar falha enquanto o contexto usa Base44/localStorage mock.
- [ ] Implementar cliente e contexto mantendo props/contrato usados pelo layout.
- [ ] Remover login sem senha e `mm_mock_user`; nunca guardar token em localStorage.
- [ ] Rodar testes frontend, lint, typecheck e build.

### Task 6: Bootstrap local seguro

**Files:**
- Create: `backend/app/commands/create_local_admin.py`
- Modify: `README.md`
- Modify: `.env.example`
- Create: `backend/tests/test_create_local_admin.py`

**Interfaces:**
- Produces: comando idempotente que recebe email/senha por argumentos seguros ou ambiente e cria tenant/membership admin local.

- [ ] Escrever testes de criação, repetição idempotente, recusa de senha vazia e ausência de impressão da senha.
- [ ] Confirmar falha por comando ausente.
- [ ] Implementar transação única e mensagens sem segredos.
- [ ] Documentar preparo local sem credenciais padrão.
- [ ] Rodar testes e verificar que nenhum segredo aparece no Git.

### Task 7: Evidência funcional da primeira fatia

**Files:**
- Modify: `docs/FRONTEND_VALIDATION_MATRIX.md`
- Modify: `docs/BASE44_MIGRATION_MAP.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `project-status.json`

**Interfaces:**
- Produces: evidência honesta de identidade/tenancy migradas; demais capacidades continuam pendentes.

- [ ] Executar migration do zero e upgrade/downgrade/upgrade em banco descartável.
- [ ] Executar suíte backend completa, integração PostgreSQL, frontend tests, lint, typecheck e build.
- [ ] Navegar login, refresh, logout, troca de empresa e acesso negado no browser.
- [ ] Executar com a Central parada e provar independência da fatia.
- [ ] Atualizar a matriz por evidência; não declarar o MediaMind inteiro migrado.

## Verificação final do plano

- [ ] `rg -n "@base44/sdk|base44\.auth|mm_mock_user" frontend/src/lib frontend/src/mediamind/auth.jsx frontend/src/mediamind/pages/Login.jsx` não encontra runtime na fatia migrada.
- [ ] `python -m pytest` passa, incluindo PostgreSQL quando marcado para o gate.
- [ ] `npm test`, `npm run lint`, `npm run typecheck` e `npm run build` passam.
- [ ] login e operações essenciais da fatia funcionam com a Central desligada.
- [ ] export, schemas Base44 e tag `base44-export` permanecem intactos.

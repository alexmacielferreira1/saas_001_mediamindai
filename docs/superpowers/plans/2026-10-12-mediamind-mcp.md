# MediaMind MCP Transversal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um primeiro Centro MCP visual e um núcleo backend autenticado de descoberta e execução somente leitura.

**Architecture:** Um registro canônico no backend descreve módulos e tools; uma rota autenticada lista o catálogo e outra chama somente tools permitidas. O frontend exibe o catálogo e o histórico real de chamadas em uma nova guia das Ferramentas IA.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy/session tenancy existente, React, Vitest, Pytest.

**Spec:** `docs/superpowers/specs/2026-10-12-mediamind-mcp-design.md`

## Global Constraints

- Primeira versão somente leitura.
- Sessão e vínculo ativo são obrigatórios.
- Sem acesso direto do MCP ao banco, storage ou segredos.
- Módulos sem adaptador devem aparecer como planejados, nunca como funcionais.
- Nenhuma alteração em Render, Neon ou produção nesta tarefa.

## Review Focus

- Sessão ausente deve receber 401 sem catálogo.
- Tenant deve vir da sessão e não de argumentos.
- Tool desconhecida deve falhar de forma segura.
- Tool planejada não pode executar.
- Falha de backend deve aparecer como indisponibilidade, sem resultado simulado.

---

### Task 1: Registro e API MCP somente leitura

**Files:**
- Create: `backend/app/mcp/registry.py`
- Create: `backend/app/schemas/mcp.py`
- Create: `backend/app/api/v1/mcp.py`
- Modify: `backend/app/api/v1/__init__.py`
- Test: `backend/tests/test_mcp_api.py`

**Interfaces:**
- Produces: `GET /api/v1/mcp/tools` e `POST /api/v1/mcp/tools/{tool_name}/call`.

- [ ] Escrever testes de autenticação, catálogo, execução segura e recusas.
- [ ] Executar os testes e confirmar falha pela ausência das rotas.
- [ ] Implementar o registro mínimo e as rotas autenticadas.
- [ ] Executar os testes direcionados e a suíte backend.

### Task 2: Cliente e Centro MCP visual

**Files:**
- Create: `frontend/src/mediamind/lib/mcpApi.js`
- Create: `frontend/src/mediamind/components/ai-tools/MCPCenter.jsx`
- Create: `frontend/src/mediamind/components/ai-tools/MCPCenter.test.jsx`
- Modify: `frontend/src/mediamind/lib/aiToolsRegistry.js`
- Modify: `frontend/src/mediamind/pages/AITools.jsx`
- Modify: `frontend/src/mediamind/pages/AITools.test.jsx`

**Interfaces:**
- Consumes: catálogo e chamada do Task 1.
- Produces: guia `MCP Central`, visão de módulos, tools e histórico de execução.

- [ ] Escrever testes para catálogo, estados planejados, execução e erro real.
- [ ] Executar os testes e confirmar falha pela ausência da guia/componente.
- [ ] Implementar cliente e painel visual mínimo.
- [ ] Executar testes direcionados, lint e build.

### Task 3: Validação funcional e documentação

**Files:**
- Modify: `docs/PROJECT_STATUS.md`

**Interfaces:**
- Consumes: Tasks 1 e 2 completos.
- Produces: evidência verificável da primeira fatia MCP.

- [ ] Validar a tela no navegador local com superadmin.
- [ ] Confirmar execução real de `system.capabilities` e histórico visível.
- [ ] Registrar testes e limites sem avançar o marco M0.

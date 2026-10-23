@AGENTS.md

# Notas para o Claude Code

O `AGENTS.md` acima é a fonte de verdade deste produto. Este arquivo existe porque o Claude
Code lê `CLAUDE.md`, não `AGENTS.md`; acrescente regras novas no `AGENTS.md`.

## Orientação rápida
- Mapa do código: `docs/MAPA_DO_PROJETO.md`. Estado e gates: `project-status.json`.
- Leia só os documentos da área que vai alterar. `docs/history/`, os PNGs em `docs/`, `work/`
  e `tmp/` são material histórico ou de terceiros: abra apenas quando a tarefa exigir.
- Para varreduras amplas, use um subagente de exploração e traga só a conclusão.

## Comandos (Linux e sessões na nuvem)
- Backend: `.venv/bin/python -m pytest backend/tests -q` (focado: acrescente o caminho do teste).
- Lint: `.venv/bin/ruff check backend` e `.venv/bin/ruff format --check backend`.
- Frontend (em `frontend/`): `npx vitest run`, `npm run lint`, `npm run build`.
- No Windows, os scripts oficiais continuam sendo os de `scripts/*.ps1`.

## Qualidade
- Roteiro de auditoria: `docs/REVISAO_QUALIDADE.md`. Relatórios: `docs/AUDITORIA_QUALIDADE_*.md`.
- Mudanças em auth, permissões, dados de empresas, uploads, IA ou custos: rode `/security-review`
  antes de considerar o bloco pronto.

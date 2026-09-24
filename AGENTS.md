# Instruções de mediamind

Ordem de leitura: `AGENTS.md` → `../_documentacao/HUB_PLATFORM_STANDARD.md` → `docs/ARCHITECTURE.md` → `docs/PROJECT_STATUS.md`/`project-status.json` → `docs/CODEX_BACKLOG.md` → `docs/CODEX_HANDOFF.md` → fontes históricas.

O MediaMind é a primeira referência publicada do HUB em GitHub/Render/Neon. Preserve produção e o Workspace original. Mudanças publicáveis devem ser pequenas, testadas, reversíveis e nunca incluir secrets. Soluções específicas permanecem aqui; somente soluções horizontais validadas podem ser promovidas ao padrão do HUB.

Leia README.md, docs/ARCHITECTURE.md, docs/DEVELOPMENT_WORKFLOW.md, docs/PROJECT_STATUS.md e project-status.json.
Trabalhe no marco atual. Não avance com Quality Gate falhando.
Preserve frontend, rotas, SDK e funcionalidades Base44; não fazer redesign nem converter domínio em M0.
Banco e Git independentes. Nunca acessar banco ou código interno de outro SaaS.
Sem secrets versionados. Cloud e produção só podem ser alteradas com autorização explícita e depois de homologação proporcional ao risco.
Não apagar arquivos do usuário. Originais na pasta do HUB são somente referência.
Testar mudanças relevantes, registrar dependências e evidências reais. Não declarar paridade pela presença de telas.
Documentos históricos e AGENTS do export descrevem a origem; o roteiro atual é FastAPI/PostgreSQL local.

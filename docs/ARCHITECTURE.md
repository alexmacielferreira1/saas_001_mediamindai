# Arquitetura de MediaMind AI

Cada produto é independente: repositório, backend, frontend, configuração, banco e migrations próprios. Não há importação de código de outro SaaS nem acesso cruzado a bancos.

## Implementado no bootstrap

FastAPI com app factory; configuração Pydantic Settings em `.env`; SQLAlchemy 2 com session factory; PostgreSQL 16 via Compose; Alembic com revisão inicial `0001_bootstrap`. Essa revisão estabelece histórico e não cria tabelas de negócio.

Rotas: `/health` (liveness sem banco), `/version` (VERSION), `/ready` (SELECT 1 com timeout, HTTP 503 se indisponível). IDs de correlação recebidos são validados; request ID é gerado por requisição. Erros possuem código, mensagem pública, referência, correlation ID e indicação de retry. Logs estruturados omitem corpo, query, credenciais e texto de exceções.

Somente ambiente local/teste nesta etapa; servidores e banco vinculados a 127.0.0.1. Não há endpoints de negócio protegidos, autenticação remota, RLS, RBAC, AuditLog persistente, outbox ou contrato administrativo ainda. Isso pertence aos próximos marcos.

## Frontend

Export React/Vite intacto com SDK Base44. Não foi criada interface substituta. Build e servidor local funcionam; autenticação e dados ainda dependem da origem ou usam mocks. Ver baseline e mapa de migração antes de qualquer alteração.

## Independência e evolução

A futura Central se comunica com SaaS por API. Nada em M0 depende dela estar online. Pastas reservadas não representam módulos implementados. Ainda não extrair shared packages: validar primeiro nos dois produtos.

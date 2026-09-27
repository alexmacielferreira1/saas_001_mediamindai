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

## Contrato administrativo com o HUB

O primeiro adaptador administrativo nativo expõe `/.well-known/hub/manifest` sem credenciais e protege `/api/hub/v1/health`, `/api/hub/v1/readiness` e `/api/hub/v1/version` com identidade de serviço. A autenticação exige token de ambiente, audiência e escopo `hub:observe`; o token nunca aparece nas respostas ou no frontend. Cada resposta observável identifica produto, ambiente e horário da medição.

Este contrato não compartilha banco e não torna o MediaMind dependente da Central. Em produção, `HUB_ADMIN_TOKEN` é obrigatório; `HUB_ADMIN_AUDIENCE` e `HUB_PRODUCT_ID` identificam o contrato. Nesta primeira fatia não há comandos nem mutações remotas, e o marco permanece M0 enquanto os gates preexistentes não forem resolvidos.

O inbox de comandos administrativos persiste solicitações com correlação e idempotência por serviço. A allowlist inicial executa somente `system.describe` e `media.count`, sempre em `dry_run`; ações desconhecidas e qualquer tentativa de mutação são recusadas antes da gravação. O retorno HTTP 202 representa a primeira aceitação, enquanto uma repetição idempotente retorna o mesmo comando sem novo efeito.

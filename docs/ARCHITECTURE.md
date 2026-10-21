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

## Autorização no servidor (telas, entidades sensíveis e concessões)

Esconder tela no menu não é controle de acesso. O mapa explícito fica em `backend/app/tenancy/access_policy.py`:

- Entidades sensíveis da API `records` com permissão também para leitura: `LogAuditoria` exige `users.manage` ou `permissions.manage`.
- Tela restrita do vínculo (`restricted_screens`) bloqueia, em leitura e escrita, as entidades exclusivas daquela tela: `assessoria` → `Clipping`, `Jornalista`, `Mencao`, `Release`; `gestao` → `LogAuditoria` e `GET /management/overview`. Entidades compartilhadas (produção, ativos, cortes, revisão) ficam fora do mapa para não bloquear o fluxo operacional. Resposta: 403 `SCREEN_ACCESS_DENIED`.
- Concessão (MM-005): o gestor só cria, altera, desativa ou atribui grupos cujas permissões ele mesmo possui; só libera telas (extra ou retirada de restrição) que ele próprio acessa; só troca cargo para um cargo cujas telas padrão ele acessa; não altera vínculo de administrador sem `users.manage_admin`; cargo `superadmin` só é concedido ou alterado por superadmin. O superadmin não tem esse limite. Resposta: 403 `GRANT_EXCEEDS_AUTHORITY`. O padrão de telas por cargo espelha `frontend/src/mediamind/lib/roleCatalog.js`.

## Auditoria

`add_audit` (`backend/app/api/v1/records.py`) grava `LogAuditoria` com `action`, `entity_type`, `entity_id`, `user_id` e `details` (formato lido pela Gestão) e, de forma aditiva, `actor_role`, `correlation_id` (do cabeçalho `X-Correlation-ID` ou gerado por requisição) e, quando informados, `before`, `after`, `reason` e `target_user_id`. Cargo, grupo, telas, ciclo de grupos de permissão, suspensão/reativação/revogação de sessões e configurações da empresa gravam antes e depois sanitizados (sem segredos). As rotas de cargo, grupo, telas e edição de grupo aceitam `reason` opcional.

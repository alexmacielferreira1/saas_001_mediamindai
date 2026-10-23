# Revisão de qualidade e segurança

Roteiro padrão do HUB para auditar este produto. Vale para qualquer agente (Claude Code,
Codex, opencode) e complementa o `AGENTS.md`, sem substituí-lo. As skills instaladas em
`.claude/skills/` e os plugins de `.claude/settings.json` aprofundam cada etapa quando
disponíveis; sem elas, este documento basta.

Stack de referência do HUB: FastAPI, SQLAlchemy 2, Alembic, PostgreSQL (psycopg), React 18,
Vite e TanStack Query. Deploy em Render, Neon, Upstash e Vercel. Produtos se comunicam só
por contratos/API.

## Quando rodar

- Antes de cada publicação e ao fechar um marco (M0, M1…).
- Ao terminar um bloco que mexa em auth, permissões, dados de empresas, uploads, integrações
  externas, IA ou cobrança: rode no diff (`/diff-review` ou `/security-review`).
- Periodicamente (sugestão: a cada 2 semanas): `/improve-codebase-architecture` nos pontos quentes.

## Regras

1. Diagnóstico não altera arquivos. Correções só depois que o Alex escolher o item.
2. Todo achado cita `arquivo:linha` e um trecho curto. Sem evidência, não é achado.
3. Antes de reportar, tente **refutar** o achado: procure a dependência do FastAPI, o
   middleware ou o teste que já resolve o problema. Liste os refutados no fim.
4. Não repetir o que ruff, eslint ou typecheck já pegam. Não re-litigar `docs/DECISIONS.md`
   e `docs/adr/` sem motivo forte.
5. Correção = teste que falha primeiro → correção → teste passa → `scripts/check.ps1`.
   Um item por vez, registrando evidência como manda o `AGENTS.md`.
6. Nunca usar produção, credenciais reais ou serviços externos para testar.

## Etapa 0: mapa e foco

- Liste os pontos de entrada: routers do FastAPI, dependências de auth, webhooks, jobs/filas,
  chamadas a outros SaaS do HUB.
- `git log --oneline -n 200 --name-only`: os arquivos que mais mudam são prioridade.

## Etapa 1: segurança (prioridade máxima)

**Isolamento entre empresas**
- Toda consulta a dados de empresa filtra pelo id de empresa vindo **da sessão autenticada**,
  nunca do body, da query ou do path. Trocar um id na URL não pode expor outra empresa (IDOR).
- Superadmin/suporte: o acesso cruzado é explícito, restrito e auditado.

**Autenticação e autorização**
- Monte a lista de **todas** as rotas e marque: exige login? checa papel/permissão? Rota sem
  `Depends` de auth/permissão é achado, salvo se pública por decisão documentada.
- IAM: um usuário consegue se dar papéis, editar usuários de outra organização ou agir com
  conta suspensa? Toda ação administrativa gera auditoria, sem caminho que a pule?
- Sessão: expiração, revogação no logout, cookies `HttpOnly`/`Secure`/`SameSite=None` só onde
  o cross-domain exige, proteção contra CSRF quando o cookie é cross-site.
- Comunicação entre SaaS: token/assinatura validados, com expiração e proteção contra replay;
  segredo diferente por produto.

**Padrões inseguros (falha aberta)**
- `os.getenv("SECRET", "valor-padrao")`, credenciais demo/padrão ativas fora do ambiente local,
  `except Exception: pass` ou `return True` em verificação de permissão.
- CORS `*` com credenciais, debug/stack trace/docs (`/docs`, `/openapi.json`) expostos em produção
  sem decisão consciente.
- Chaves de provedores de IA e integrações: criptografadas em repouso? Alguma rota devolve a
  chave para o frontend? Alguma variável `VITE_*` contém segredo?

**Entradas perigosas**
- SQL com `text()` + f-string/concatenação; ordenação/filtros dinâmicos sem lista permitida.
- Upload e streaming: limite de tamanho, tipo validado no servidor, nome de arquivo e caminho
  sem path traversal, limpeza de gravação incompleta.
- SSRF: o servidor busca URL informada pelo usuário (importação, mídia, webhooks de IA)?
- Validação Pydantic em todas as fronteiras; nada de `dict` solto vindo do cliente.
- Rate limiting em login, reset de senha e endpoints caros (IA, render, import).

**Dependências e dados pessoais**
- `requirements.lock` e `package-lock.json`: vulnerabilidades conhecidas, pacotes abandonados,
  scripts de instalação (skill `supply-chain-risk-auditor`).
- LGPD: dados pessoais e tokens fora dos logs; exclusão de conta apaga de verdade.

## Etapa 2: banco de dados

- Índice nas colunas de empresa/organização e em toda FK; consultas frequentes sem índice.
- N+1 no SQLAlchemy (relacionamento lazy acessado em loop); usar `selectinload`/`joinedload`.
- Paginação por `OFFSET` em tabelas que crescem; preferir cursor.
- Escritas em várias etapas dentro de uma transação; falha parcial não deixa lixo.
- Pool de conexões compatível com o Neon (URL *pooled*, `pool_pre_ping`, sem conexão por request).
- Tipos: dinheiro/custos em `Numeric` ou inteiro de centavos, nunca `float`; datas com fuso
  (`DateTime(timezone=True)`).
- Migrations Alembic: `NOT NULL` sem default em tabela com dados, locks longos, `downgrade` ausente.

## Etapa 3: arquitetura

Vocabulário: **módulo** (tem interface e implementação), **interface** (tudo o que quem chama
precisa saber), **profundidade** (muito comportamento atrás de interface pequena), **costura**
(onde dá para trocar o comportamento sem editar ali).

- Arquivos gigantes e routers com regra de negócio que deveria morar num serviço de domínio.
- Módulos rasos que só repassam chamadas (teste da exclusão: apagar faz a complexidade sumir
  ou reaparecer espalhada?).
- Mesma regra de negócio duplicada no frontend e no backend (permissões, limites, preços).
- Dependências criadas por dentro (cliente HTTP, provedor de IA) em vez de injetadas, o que
  impede o teste.
- Smells (sempre julgamento): nome misterioso, duplicação, *feature envy*, obsessão por
  primitivos, mesmo `if/elif` repetido, mudança que exige editar muitos arquivos.

No máximo 3 candidatos de refatoração, cada um com força **Forte**, **Vale explorar** ou
**Especulativa**.

## Etapa 4: frontend

- Cascatas: `useQuery` dependentes em série que poderiam ser paralelos.
- Bundle: editores, gráficos e telas de admin sem `React.lazy`; bibliotecas pesadas importadas inteiras.
- Permissão checada só na UI (esconder botão não é autorização).
- Fluxos críticos com estados de carregando, erro e vazio; acessibilidade básica (rótulos, foco).

## Etapa 5: confiabilidade

- Exceções engolidas, chamadas externas sem timeout, jobs sem retry/idempotência.
- Logs e monitoramento nos fluxos de login, dados de empresa e custos de IA.
- Backup/restauração testados em ambiente isolado.

## Formato do relatório

Salvar em `docs/AUDITORIA_QUALIDADE_<AAAA-MM-DD>.md`:

1. Resumo em 5 linhas com os 3 maiores riscos.
2. Tabela: `# | Severidade | Área | Onde | Problema | Cenário de falha | Correção | Esforço (P/M/G)`.
   Severidades: **Crítico** (vazamento entre empresas, conta ou dinheiro), **Alto**, **Médio**, **Baixo**.
3. Até 3 candidatos de arquitetura.
4. Plano: esta semana / este mês / depois.
5. Achados refutados (uma linha cada).
6. Perguntas de negócio para o Alex, cada uma com recomendação.

## Ferramentas disponíveis (Claude Code)

| Comando ou skill | Uso |
|---|---|
| `/security-review` | Segurança das mudanças pendentes da branch |
| `/insecure-defaults:audit` | Varredura de padrões inseguros no repositório inteiro |
| `/diff-review` | Revisão de segurança de um PR/diff com raio de impacto |
| `supply-chain-risk-auditor` | Auditoria de dependências |
| `/improve-codebase-architecture` | Candidatos de refatoração com relatório HTML |
| `diagnosing-bugs` | Depuração: reprodução que falha → hipóteses → correção + teste de regressão |
| `/grill-me` | Ser questionado sobre um plano antes de implementar |
| `supabase-postgres-best-practices`, `neon`, `neon-postgres` | Regras de Postgres e Neon |
| `vercel-react-best-practices`, `web-design-guidelines`, `composition-patterns` | React/UI (ignore regras exclusivas de Next.js) |

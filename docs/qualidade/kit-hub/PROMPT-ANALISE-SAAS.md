# Prompt único: análise crítica de um SaaS

> Cole o texto abaixo (da linha "Você é..." até o fim) no Claude Code, Cursor, Codex ou
> outro agente, aberto **na pasta do seu projeto**. Ele junta o que há de útil nas skills
> do Matt Pocock (arquitetura, code smells, depuração), da Trail of Bits (segurança), da
> Vercel (React/Next.js) e da Supabase/Neon/Stripe (Postgres e pagamentos), num único
> roteiro, sem precisar instalar nada.

---

Você é um engenheiro sênior revisando este SaaS antes de ele crescer. Seu trabalho é
**encontrar problemas reais e priorizá-los**, não elogiar nem dar conselhos genéricos.

## Regras

1. **Não altere nenhum arquivo.** Esta etapa é só diagnóstico.
2. Todo achado precisa citar `arquivo:linha` e um trecho curto do código. Sem evidência, não é achado.
3. Fatos você descobre sozinho (lendo código, `git log`, `package.json`, configs). Só me pergunte o que é **decisão de negócio**.
4. Antes de reportar cada achado, **tente refutá-lo**: procure o middleware, a validação ou o teste que já resolveria o problema. Se encontrar, descarte. Liste os descartados no fim, em uma linha cada.
5. Não repita o que um linter ou o TypeScript já pegam.
6. Escreva em português, direto.

## Passo 0: mapa e foco

- Identifique a stack (framework, ORM, banco, auth, pagamentos, hospedagem) e os pontos de entrada: rotas de API, server actions, webhooks, jobs/filas, cron.
- Rode `git log --oneline -n 200 --name-only` e descubra os **pontos quentes** (arquivos que mais mudam). Priorize-os: melhorar o que muda muito rende mais.
- Leia `README`, `CLAUDE.md`/`AGENTS.md`, `CONTRIBUTING.md` e ADRs, se existirem. Decisões já documentadas não devem ser re-litigadas sem motivo forte.

## Passo 1: segurança (prioridade máxima)

**Isolamento entre clientes (multi-tenant)**
- Toda consulta a dados de cliente filtra por `tenant_id`/`org_id`/`user_id` vindo **da sessão**, nunca do body, da query string ou da URL?
- Existe algum endpoint em que trocar um ID na URL mostra dados de outra conta (IDOR)?
- Se o projeto usa RLS no Postgres, as policies cobrem SELECT, INSERT, UPDATE e DELETE? Alguma rota usa a conexão de serviço/admin onde não deveria?

**Autenticação e autorização**
- Liste **cada** rota, server action, webhook e job, e marque: exige login? checa permissão/papel? Qualquer item sem checagem é achado.
- Sessões e tokens: expiração, revogação no logout, cookies `HttpOnly`/`Secure`/`SameSite`.
- Reset de senha, convite e verificação de e-mail: tokens de uso único, com expiração, sem enumerar usuários.

**Padrões inseguros (falha aberta)**
- Segredos com valor padrão (`process.env.JWT_SECRET || "dev-secret"`), credenciais padrão, chaves no código ou no repositório (`.env` commitado).
- Condicionais que **liberam** quando algo falha ou falta (`if (!config.authEnabled) return next()`, `catch { return true }`).
- Debug, stack traces, rotas `/admin` ou `/test` e logs verbosos ligados em produção.
- CORS `*` com credenciais, cookies sem flags, criptografia fraca (MD5/SHA1 para senha, `Math.random` para token).

**Entradas e APIs perigosas**
- SQL montado com concatenação ou template string, `$queryRawUnsafe`, `eval`, `dangerouslySetInnerHTML`, redirecionamento aberto, upload sem limite de tipo e tamanho, SSRF (busca de URL fornecida pelo usuário).
- Validação de entrada no servidor (zod/valibot ou similar) em **todas** as fronteiras, não só no front.

**Pagamentos e webhooks**
- Webhooks verificam a **assinatura** com o corpo bruto?
- Processamento **idempotente** (o mesmo evento chegando 2 vezes não credita nem cobra 2 vezes)?
- O acesso pago é liberado pelo webhook/estado no servidor, e não pela página de "sucesso" do checkout?
- O preço vem do servidor, nunca do cliente?
- Os estados de assinatura (trial, inadimplente, cancelada) são tratados?

**Abuso e operação**
- Rate limiting em login, cadastro, reset de senha e endpoints caros (ex.: chamadas a IA).
- Dependências: pacotes abandonados, com vulnerabilidades conhecidas ou com scripts de instalação (`npm audit` ajuda, mas leia o lockfile).
- LGPD: dados pessoais em logs, exclusão de conta que realmente apaga os dados, segredos e PII fora de ferramentas de analytics.

## Passo 2: banco de dados (Postgres)

- Colunas usadas em `WHERE`/`JOIN`/`ORDER BY` frequentes sem índice, e chaves estrangeiras sem índice.
- Consultas N+1 (loop que faz uma query por item), `SELECT *` em tabelas largas, paginação por `OFFSET` em tabelas grandes (prefira cursor).
- Conexões: em ambiente serverless (Vercel, funções), usar pool/driver serverless (ex.: URL *pooled* do Neon), sem abrir conexão por requisição.
- Transações longas ou ausentes onde várias escritas precisam ser atômicas (ex.: criar conta + assinatura).
- Migrations perigosas: `ALTER` que trava tabela grande, coluna `NOT NULL` sem default, migrations sem caminho de volta.
- Tipos: dinheiro em `float` (use inteiro de centavos ou `numeric`), datas sem fuso (`timestamptz`), IDs sequenciais expostos publicamente.

## Passo 3: arquitetura (o "ball of mud")

Use este vocabulário: **módulo** (qualquer coisa com interface e implementação), **interface** (tudo o que quem chama precisa saber: tipos, ordem de chamada, erros, configuração), **profundidade** (quanto comportamento cabe atrás de uma interface pequena), **costura** (o lugar onde dá para trocar o comportamento sem editar ali).

Procure:
- **Módulos rasos**: a interface é quase tão complexa quanto a implementação; funções que só repassam a chamada.
- **Teste da exclusão**: imagine apagar o módulo. Se a complexidade some, ele era só passagem. Se reaparece espalhada em vários lugares, ele se paga.
- **Regras de negócio espalhadas**: entender um conceito (ex.: "assinatura", "limite do plano") exige pular entre muitos arquivos, ou a mesma regra está duplicada na UI, na API e no job.
- Lógica de negócio dentro de componentes React, route handlers ou SQL solto, em vez de um módulo de domínio testável.
- Dependências criadas por dentro (`new StripeClient()` no meio da função) em vez de recebidas por parâmetro, o que torna a função impossível de testar.
- Partes críticas (cobrança, permissões, limites de plano) sem nenhum teste, ou difíceis de testar pela interface atual.

**Code smells (Fowler), sempre como julgamento e nunca como regra absoluta:** nome misterioso, código duplicado, *feature envy*, grupos de dados que andam juntos e pedem um tipo, obsessão por primitivos (string/number no lugar de um conceito de domínio), o mesmo `switch` repetido, uma mudança que obriga a editar muitos arquivos (*shotgun surgery*), um arquivo que muda por motivos não relacionados, generalidade especulativa, cadeias longas `a.b().c().d()`, intermediário que só delega.

## Passo 4: frontend (se for React/Next.js)

- **Cascatas de requisições**: `await` em série que poderiam rodar em paralelo, ou componentes que só buscam dados depois que o pai terminou.
- **Bundle**: bibliotecas pesadas importadas inteiras, código de admin ou gráficos no bundle inicial, `"use client"` em árvores que poderiam ser renderizadas no servidor.
- Re-renderizações desnecessárias em listas grandes, estado global onde um estado local bastaria.
- Acessibilidade e UX: botões sem rótulo, formulários sem estados de carregando, erro e vazio, foco perdido, falta de feedback em ações de pagamento.
- Segredos ou chaves de API expostos no cliente (`NEXT_PUBLIC_*` que não deveria ser público).

## Passo 5: confiabilidade

- Erros engolidos (`catch {}`), ausência de logs ou de monitoramento (Sentry ou similar) nos fluxos de dinheiro e de auth.
- Jobs e webhooks sem retry, sem timeout ou sem tratamento de falha parcial.
- Chamadas externas (pagamento, e-mail, IA) sem timeout.
- Ausência de backup testado ou de ambiente de staging separado de produção.

## Formato da entrega

1. **Resumo em 5 linhas**: estado geral e os 3 maiores riscos.
2. **Tabela de achados**, ordenada por severidade:

| # | Severidade | Área | Onde (`arquivo:linha`) | Problema | Cenário concreto de falha | Correção sugerida | Esforço (P/M/G) |
|---|---|---|---|---|---|---|---|

   Severidades: **Crítico** (vazamento de dados, dinheiro ou conta), **Alto** (bug provável em produção ou brecha explorável com algum esforço), **Médio** (dívida que vai doer ao crescer), **Baixo** (higiene).

3. **Arquitetura**: no máximo 3 candidatos de refatoração. Para cada um: arquivos envolvidos, o problema, a solução em português simples, o ganho (onde ficam a mudança e os testes depois) e a força da recomendação (**Forte**, **Vale explorar** ou **Especulativa**).
4. **Plano de ataque**: o que corrigir esta semana, este mês e depois.
5. **Achados descartados**: os que você refutou no passo de verificação, uma linha cada.
6. **Perguntas de negócio** que só eu posso responder, numeradas, cada uma com a sua recomendação de resposta.

Depois de entregar, pare e espere eu escolher o que corrigir. Quando eu escolher um item: escreva primeiro um teste que **falha** demonstrando o problema, depois corrija, depois confirme que o teste passa. Um item por vez.

## Se eu pedir para depurar um bug

Siga esta ordem, sem pular etapas:
1. Monte um comando que reproduza o bug e **falhe** (teste, script ou `curl`), rápido e determinístico. Sem isso, não formule teorias.
2. Reduza o caso até o mínimo que ainda falha.
3. Liste de 3 a 5 hipóteses ranqueadas, cada uma com uma previsão testável, e me mostre antes de testar.
4. Instrumente uma variável por vez, com logs marcados (`[DEBUG-xxxx]`).
5. Escreva o teste de regressão, corrija e confirme.
6. Remova todos os logs de debug e explique a causa real.

# Relatório 23/10/2026 — Dados de exemplo gravados no banco, diagnóstico geral e limpeza

Registro completo do chat de 23/10/2026 (sessão Claude Code na nuvem). Serve de ponto de retomada: o que foi perguntado, decidido, verificado, corrigido e o que ficou pendente.

## 1. Resumo para quem retoma

- **Bug corrigido e já na `main`** ([PR #13](https://github.com/alexmacielferreira1/saas_001_mediamindai/pull/13), commit `9e7bbb1`, merge `a9b7927`): telas do frontend gravavam dados de exemplo (mocks) no banco real de empresas sem registros, às vezes em duplicidade. Agora os exemplos aparecem iguais na tela, mas nunca são gravados.
- **Consulta de limpeza criada** (`scripts/sql/find_demo_seed_records.sql`, somente leitura): lista, por empresa, os registros fictícios que a versão antiga gravou. **Ainda não foi executada em nenhum banco real.** Nada foi apagado.
- **Script de varredura de telas** (`scripts/qa/route_crawl.mjs`): abre todas as rotas logado e lista erros de JS, de console e respostas 4xx/5xx da API.
- Visual do app **não foi alterado** (pedido explícito de Alex).
- Pendências e decisões abertas: seção 7.

## 2. Ponto de partida: a proposta de usar o Base44

Alex perguntou se valeria levar o projeto ao Base44 para corrigir bugs e trazer de volta só as melhorias. Recomendação dada (e aceita: "não farei nada agora no base44"):

- O Base44 não corrige o FastAPI/PostgreSQL: ele substitui backend, banco, autenticação e arquivos pelo SDK e backend dele. Muitos bugs "somem" porque a parte com bug deixa de existir.
- O que volta é uma reescrita, não um patch. Separar correção real de adaptação à plataforma custa mais e arrisca quebrar o que funciona.
- "Conexão de arquivos e funcionalidades" é justamente a parte mais acoplada ao SDK deles.
- Alternativa adotada: atacar os bugs aqui, de forma sistemática (reproduzir no navegador, achar a causa, corrigir com teste). O Base44 pode servir só como referência visual pontual.

## 3. Linha de base medida antes de qualquer alteração

Ambiente: container Linux na nuvem, clone de `main` em `51e2fc8`, Python 3.12 (venv), PostgreSQL 16 local na porta 5433, Node 22.

| Verificação | Resultado |
|---|---|
| Backend `pytest` (todo `backend/tests` + `tests`) | **666 aprovados, 2 ignorados**. Duas falhas iniciais eram do ambiente: `AI_SECRET_KEY`/`THUMBNAIL_SECRET_KEY` preenchidas no `.env` local (ver 7.4) |
| Frontend `vitest` | **1845 testes / 222 arquivos aprovados** (~17 min; `maxWorkers: 1`) |
| Frontend `npm run lint` | aprovado |
| Frontend `npm run build` | aprovado (avisos já conhecidos de bundle grande e import dinâmico ineficaz) |
| `npm ci` | falhava com **npm 10** (lock sem `chokidar@5`/`readdirp@5`, peer opcional de `nitro`); passava com **npm 11** (Node 24, usado no CI). Depois corrigido na `main` por outro trabalho no commit `0ea1660` |
| Contrato frontend × backend | as **82 chamadas** `request(...)` do frontend batem com rotas e métodos existentes do FastAPI (comparado com o OpenAPI). Nenhuma rota/método trocado |
| Varredura no navegador | 29 rotas × 4 perfis (admin, superadmin, editor, repórter) — achados na seção 4 e 7 |

`scripts/test-report.ps1` não foi usado: não há PowerShell no container. Os mesmos gates foram executados diretamente (pytest, vitest, eslint, vite build).

## 4. O que a varredura de telas encontrou

1. **Dados fictícios gravados no banco (corrigido — seção 5).** Com o banco vazio, apenas navegar criou 38 registros: 8 `Asset`, 4 `Script`, 3 `Clip`, 7 `ProducaoProjeto`, 10 `AgendaEvento` e 6 `LogAuditoria` (auditoria dessas gravações). Sintoma visível: o Roteiro2 tentava tocar 8 mídias inexistentes (`GET /media/assets/<id>/stream` → 404).
2. **Agenda duplicada (corrigido junto).** `ProdutoraPage` e `RoleOverview` aparecem juntos e cada um chamava o seed; as duas cargas viam a agenda vazia e gravavam (lotes com 33 ms de diferença). O Início por papel (`roleInicioData.js`) também semeava a agenda.
3. **404 em 6 entidades não migradas (não alterado — 7.1).** Início/Pesquisa pedem `Project`, `Task`, `SavedSearch`, `RecentActivity`, `Library`, `IngestPackage`; o backend não as aceita (`ALLOWED_TYPES` em `backend/app/api/v1/records.py`). O frontend já trata o erro e mostra os exemplos.
4. **Erro "useAuth deve ser usado dentro de AuthProvider" em `/agencia-video` (não é bug do app).** Apareceu uma vez com o perfil editor; não reproduziu em 6 tentativas. Coincidiu com edições de arquivos durante a varredura: recarga a quente (HMR) do Vite em modo dev.

## 5. Correção aplicada (PR #13)

**Causa.** Funções `loadOrSeed*` do frontend faziam `bulkCreate` dos mocks quando a lista da empresa vinha vazia. O próprio projeto já registrava isso como prioridade alta ("Dados fictícios misturados ao projeto real", `docs/QA_USABILIDADE_2026-10-20.md`) e `docs/REBUILD_DESIGN.md` exige recusar seeds demo em produção.

**Decisão de Alex.** Entre três opções (mostrar sem gravar / só evitar duplicação / estado vazio), escolheu **mostrar sem gravar**: visual igual, nada fictício no banco, ações sobre exemplos bloqueadas com aviso.

**Implementação** (só frontend; backend e visual intocados):

| Arquivo | Mudança |
|---|---|
| `frontend/src/mediamind/lib/demoCatalog.js` | `markDemoRecords(rows)`: marca exemplos com `is_demo`/`demo_dataset` (marcador já existente, reaproveitado) |
| `lib/mamData.js` | Início/Pesquisa: devolve o mock marcado, sem gravar |
| `lib/corpAgenda.js`, `lib/corpPendencias.js` | idem |
| `lib/corpAprovacoes.js` | idem, mantendo `status: 'pendente'` e `prioridade` como os registros semeados tinham |
| `lib/corpPublicacoes.js`, `lib/corpAssessoria.js` | idem (Publicações, Releases, Clippings, Jornalistas, Menções), mantendo a normalização de campos e o `id` do mock |
| `lib/producaoStore.js` | não semeia mais; editar projeto de exemplo não o cria no servidor — aviso "Projeto de demonstração" (uma vez por projeto) e estado de gravação "erro". Produções novas continuam salvando |
| `components/corp/CorpPublications.jsx` | "Excluir" de exemplos continua bloqueado: passou a usar `isDemoRecord`, porque a comparação por referência com o mock deixaria de funcionar (regressão pega pelos testes) |

Editar/aprovar itens de exemplo nos demais módulos já falha no servidor sem gravar: os ids dos mocks não são UUID.

**Testes.** 14 novos (`lib/demoFallbackNoWrite.test.js`, `lib/mamData.test.js`, `lib/producaoStore.test.jsx`): cada loader devolve exemplos marcados sem chamar `bulkCreate`/`create`; cargas simultâneas não duplicam; exemplo de produção não é criado; produção nova continua salvando.

**Evidência.** Frontend completo: **1859 testes / 223 arquivos**, lint e build aprovados. Banco zerado + navegação em todas as rotas: **0 registros gravados** (antes 38). Capturas confirmaram as telas iguais, com os exemplos visíveis.

## 6. Limpeza dos bancos que já usaram a versão antiga

Arquivo: `scripts/sql/find_demo_seed_records.sql`. **Somente `SELECT`.**

```bash
psql "$DATABASE_URL" -f scripts/sql/find_demo_seed_records.sql
```

Colunas: empresa, entidade, título, id do registro, data de criação e dois sinais:

- `gravado_em_lote` — gravado no mesmo segundo que outros exemplos da mesma entidade e empresa, como o seed fazia. `false` indica provável coincidência com dado real.
- `editado_depois` — modificado depois da criação. Alguém pode ter reaproveitado o exemplo como dado real: revisar antes de excluir.

Os títulos vêm de `frontend/src/mediamind/data.js`, cobrindo todas as chamadas do seed antigo: `MOCK_ASSETS`, `MOCK_SCRIPTS`, `MOCK_CLIPS`, `MOCK_CORP_PRODUCAO_PROJETOS`, `MOCK_CORP_AGENDA_EVENTS` + `MOCK_CORP_AGENDA_EDICAO`, `MOCK_CORP_PENDENCIES`, `MOCK_CORP_APPROVAL_QUEUE`, `MOCK_CORP_PUBLICATIONS`, `MOCK_CORP_RELEASES`, `MOCK_CORP_CLIPPINGS`, `MOCK_CORP_JOURNALISTS`, `MOCK_CORP_MENTIONS`. Se os mocks mudarem, a lista precisa ser regerada.

**Validação.** A versão anterior à correção (`51e2fc8`) foi executada contra um banco local zerado e gravou os mesmos registros de produção. A consulta encontrou **32 de 32** fictícios, incluindo as duplicatas da agenda e o evento vindo da agenda de edição (que a primeira versão da consulta não cobria e foi corrigida). Casos de controle: um registro real com título igual a um exemplo, criado sozinho, saiu com `gravado_em_lote = false`; um exemplo editado saiu com `editado_depois = true`.

**Cuidados antes de qualquer exclusão (não feita):** backup do banco; não apagar `LogAuditoria` (trilha de auditoria); revisar linhas com `editado_depois = true` ou `gravado_em_lote = false`; excluir só por id, depois de conferir a lista com Alex.

## 7. Pendências e decisões abertas

1. **Entidades não migradas** (`Project`, `Task`, `SavedSearch`, `RecentActivity`, `Library`, `IngestPackage`). Geram 404 em toda carga de Início/Pesquisa. Opções: migrar para o backend (com permissões em `record_policies`) ou o frontend deixar de pedi-las. Liberá-las no backend antes desta correção teria espalhado mais mocks no banco; depois dela, não grava mais.
2. **Exemplos sem rótulo na tela.** A correção resolveu a gravação, não a exibição: empresas sem dados ainda veem exemplos sem selo "Demonstração" (item 1 de "Sugestões para Alex decidir" em `docs/QA_USABILIDADE_2026-10-20.md`). Os registros agora carregam `is_demo`, o que facilita um selo futuro sem nova estrutura de dados.
3. **Executar a consulta da seção 6** nos bancos de produção/homologação e decidir o que excluir.
4. **Testes do backend dependem do `.env` local.** `test_ai_api.py::test_local_environment_creates_private_master_key_for_ai_settings` e `test_thumbnail_settings_api.py::test_external_configuration_requires_server_secret` falham quando `AI_SECRET_KEY`/`THUMBNAIL_SECRET_KEY` estão preenchidas no `.env`. Os testes deveriam isolar essas variáveis. Escopo da configuração de IA pertence a outro chat (AGENTS.md); registrado aqui sem edição.
5. **Observado só na leitura, não testado:** em sessão demo local, `entityClient.filter()` de `frontend/src/api/base44Client.js` ignora `filters` e `sort` e devolve todos os registros da entidade.
6. Varredura por perfil usou admin, superadmin, editor e repórter; os demais papéis não foram exercitados.

## 8. Como reproduzir a verificação

1. Python 3.12: `uv venv -p python3.12 .venv` e `uv pip install -r requirements.lock`.
2. PostgreSQL 16 na porta 5433 com usuário/banco `mediamind` (ou `scripts/setup.ps1` no Windows); `.venv/bin/alembic upgrade head`.
3. `.env` a partir de `.env.example`, com `DEMO_PASSWORD` preenchida; `PYTHONPATH=backend .venv/bin/python scripts/seed_demo.py` (33 contas).
4. API: `PYTHONPATH=backend .venv/bin/uvicorn app.main:app --port 8000`. Frontend: `npx vite --port 5173` em `frontend/` (npm 11 / Node 24 para `npm ci`).
5. Varredura: `MM_PASSWORD=<DEMO_PASSWORD> node scripts/qa/route_crawl.mjs admin@mediamind.ai` (requisitos no cabeçalho do script).
6. Conferir gravações: `select entity_type, count(*) from tenant_records group by 1;`

## 9. Histórico Git deste trabalho

| Ref | Conteúdo |
|---|---|
| `51e2fc8` | `main` no início do chat |
| `9e7bbb1` | fix: exibir dados de exemplo sem gravá-los no banco da empresa (branch `fix/dados-demo-sem-gravar`) |
| `a9b7927` | merge do PR #13 na `main` |
| branch `chore/documentacao-e-consulta-dados-demo` | este relatório, a consulta SQL e o script de varredura |

O primeiro push foi recusado (HTTP 403) até Alex liberar o acesso do app Claude ao repositório no GitHub; depois disso funcionou.

# Testes E2E (ponta a ponta) do MediaMind

Playwright + Chrome instalado (`channel: "chrome"`, sem baixar navegadores). Pacote próprio em
`tests/e2e/` (lock próprio): o `frontend/package-lock.json` não foi alterado.

## Como rodar (um comando, PowerShell, na raiz do produto)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e2e.ps1
# só alguns cenários:  ... -File scripts/e2e.ps1 -Grep "4a|4b"
```

Pré-requisitos: Docker Desktop aberto (container `hub-mediamind-postgres-1`), `.venv` do checkout
(Python 3.12), `npx -y npm@11 ci` em `frontend/` e Google Chrome. O script instala o Playwright de
`tests/e2e/` na primeira vez (`npm ci`).

O que o script faz:

1. Liga o PostgreSQL local (127.0.0.1:5433) e cria, se não existirem, o papel `mediamind_e2e` e o
   banco `mediamind_e2e` (só `CREATE`/`ALTER ROLE`; nada é apagado). A senha do papel é aleatória
   a cada execução e vai por stdin ao `psql`.
2. Migra com Alembic e semeia **duas empresas e dois usuários novos por execução**
   (`tests/e2e/seed_e2e.py`, recusa rodar fora de `ENVIRONMENT=test` ou de banco `*_e2e`). A senha
   dos usuários é aleatória, passada só por variável de ambiente; o login preenche a senha por
   `evaluate` (não aparece nos passos do relatório) e o trace do Playwright fica desligado (ele
   gravaria o corpo do POST de login). No fim, o script procura a senha nos arquivos de texto da
   execução e falha se encontrar.
3. Sobe a API na porta **8020** e o Vite na **5190** (`MEDIAMIND_API_PROXY` → 8020) por
   `tests/e2e/no_dotenv.py`, que **ignora o `.env` do checkout**: sem chaves reais de IA/OAuth/demo.
4. Roda os cenários e encerra só os processos que iniciou.

Saída de cada execução: `.runtime/e2e/<execução>/` — `report/index.html`, `results.json`,
`artifacts/` (captura + contexto de cada falha), `exports/` (arquivos exportados), logs da API/Vite,
`state.json` (IDs criados) e `accounts.json` (e-mails/IDs das empresas, sem senha).
Os dados ficam só no banco `mediamind_e2e`, identificados pelo ID da execução; não há limpeza
automática.

## Cenários

Toda página é monitorada: falha em `console.error`, erro de página ou resposta 4xx/5xx da API não
declarada como esperada (a única esperada global é o 401 de `/auth/session` antes do login).

| # | Arquivo | Cobre |
|---|---|---|
| 1 | `01-auth` | Login inválido mostra “E-mail ou senha inválidos.” e não cria sessão; login válido abre `/corp`, sessão na empresa certa; Sair encerra a sessão (API 401) e rota protegida volta ao login. |
| 2 | `02-midia` | Vídeo WebM (canvas + tom de áudio, gerado no Chrome) e PNG enviados pelo Ingest; registro `Asset` no servidor com tipo/tamanho/pacote; download devolve o mesmo tamanho; Acervo lista, filtra pela busca e conta os arquivos; busca global `/search`. |
| 3 | `03-producao` | Produção criada em Rascunhos, editada e persistida (recarregar + API); Roteiro 2 criado vinculado à mídia, salvo e persistido; Agendamento (data/hora) → Gravações (registro + upload real do material) → Para editar → Em edição, com histórico no servidor. |
| 4a | `04-timeline` | Workspace → importar mídia (upload, stream com o mesmo tamanho) → Timeline: clipe em V1 com áudio vinculado em A1, mover (arrasto), dividir, aparar, desfazer/refazer, título, salvar, recarregar (documento idêntico) e exportar sequência (MP4 via FFmpeg ou mensagem honesta “O motor local de exportação não está disponível.”). |
| 4b | `04-timeline` | MMFilm (Ferramentas Gráficas): importar, montar vídeo+áudio vinculados, mover (o par acompanha), Razor, desfazer/refazer, título em V2, Salvar como, recarregar a página + Recarregar projeto (5 clipes), religar mídia e exportar WebM real (arquivo salvo e conferido). |
| 5 | `05-revisao-publicacao` | Em edição → Em revisão → Aprovar versão → Finalizado → Agendar publicação; publicação persistida no servidor e visível após recarregar; relatório (API e tela Gestão → Relatórios → Conteúdo). |
| 6 | `06-isolamento` | Mesmo navegador: A sai, B entra. Listas de B sem itens de A; GET/PATCH/DELETE por ID de A → 404 (asset, produção, roteiro, stream); Acervo, Rascunhos, Edição, Roteiro 2 e Timeline de B sem itens de A; produção de A intacta. |
| 7 | `07-varredura` | 29 rotas do `App.jsx` abertas logado: sem tela branca/404, sem console.error e sem 4xx/5xx. |

## Resultado real (24/10/2026, execução `20261024132725d6ddd5`)

**31 passaram, 9 falharam — todas as falhas são bugs do app** (o teste continua falhando, sem
`skip`). Asserções marcadas como `expect.soft` registram o bug e deixam o restante do fluxo rodar.

| Cenário | Resultado |
|---|---|
| 1 Login/logout/inválido | 2/2 passou |
| 2 Upload + Acervo | passou; busca global `/search` **falhou** (bug B1) |
| 3 Produção | criação **falhou** só no `empresa_id` (B2; persistência OK); Roteiro 2 **falhou** por 404 de stream (B3; criação/persistência OK); pipeline até Edição passou |
| 4a Workspace/Timeline | **falhou** (B4, B5); dividir, aparar, desfazer/refazer, título, salvar/recarregar e exportação honesta (sem FFmpeg) passaram |
| 4b MMFilm | passou (WebM de ~2,3 MB exportado) |
| 5 Revisão → publicação → relatórios | revisão/aprovação passaram; publicação e relatório **falharam** (B6) |
| 6 Isolamento | passou |
| 7 Varredura | 25/29; falharam `/` e `/search` (B1), `/roteiro2` e `/estudio-de-arte` (B3) |

## Bugs do app encontrados

- **B1 — Início e Pesquisa pedem entidades que o backend não tem (6× HTTP 404 por visita).**
  `frontend/src/mediamind/lib/mamData.js:38-46` carrega `Project`, `Task`, `SavedSearch`,
  `RecentActivity`, `Library`, `IngestPackage`; nenhuma está em `ALLOWED_TYPES`
  (`backend/app/api/v1/records.py:30`). Evidência: `GET /api/v1/records/Project?...` → 404
  `ENTITY_NOT_FOUND` (cenários 2 e 7, rotas `/` e `/search`).
- **B2 — Produção gravada com `empresa_id` vazio.** `frontend/src/mediamind/lib/producaoStore.js:22`
  lê `localStorage['mm_current_empresa_v1']`, que nada mais grava (o `EmpresaProvider` não usa essa
  chave). Efeito: a busca global ⌘K filtra por `empresa_id`
  (`frontend/src/mediamind/components/CommandPalette.jsx:83`) e não acha as produções. Evidência:
  `GET /records/ProducaoProjeto` → `empresa_id: ""` (cenário 3).
- **B3 — Mídia enviada pelo Ingest não toca nos editores (stream 404).** Para usuário real o Ingest
  usa `/uploads` + `Asset.create` (`frontend/src/mediamind/components/IngestNewPackage.jsx:57-66`),
  sem `storage_key`; `/media/assets` devolve `stream_url` para todo `Asset`
  (`backend/app/media/assets.py:13`) e o stream responde 404. Evidência:
  `GET /api/v1/media/assets/<id do Ingest>/stream` → 404 em `/roteiro2` e `/estudio-de-arte`.
- **B4 — Timeline 2: arrastar o vídeo não leva o áudio vinculado (dessincroniza).**
  `frontend/src/mediamind/pages/Timeline2.jsx:476` usa `moveClip` só no clipe arrastado; o par
  `linkedTo` (criado pelo Workspace) fica parado. Evidência: vídeo em 5 s, áudio vinculado em 0 s
  (cenário 4a). O MMFilm faz certo (4b passou).
- **B5 — Duração do clipe não é a do arquivo quando não há FFmpeg.** Workspace usa 5 s
  (`frontend/src/mediamind/lib/timeline2Model.js:277`) e a Timeline 2 usa 30 s
  (`Timeline2.jsx:43`) quando o servidor não mediu a duração (sem ffprobe). Vídeo de 3 s virou
  clipe de 5 s. O navegador já sabe a duração real (o MMFilm mede).
- **B6 — Publicação não é registrada; relatórios ficam em zero.** “Agendar publicação”
  (`FinalizadoTimeline.jsx:77`) e “Nova publicação” (`CorpPublications.jsx:30,39-42`) só criam
  rascunho em memória; não existe `Publicacao.create` no frontend. Após recarregar, some; o
  relatório conta só `Publicacao` (`backend/app/api/v1/management.py:18`) → `published+scheduled+pending = 0`.

Achados por leitura de código (não quebram teste hoje):

- `Timeline2.jsx:541` — “Salvar projeto” grava em `…:mm_timeline2_project`, chave que ninguém lê
  (o editor lê `…:mm_timeline2_project:<id>`); a persistência funciona só pelo autosave, sem aviso.
- `backend/app/api/v1/uploads.py:19` — `/uploads` grava em `ROOT/.runtime/uploads`, ignorando
  `MEDIA_ROOT` (em produção, disco efêmero).
- `AprovacaoReviewPanel.jsx:218` — “Aprovar versão” sempre pede confirmação por causa de
  comentários de demonstração fixos.
- `FinalizadoTimeline.jsx:73` — tarefas do Finalizado vão em `tarefas`, campo que
  `toEntityData` (`producaoStore.js`) não envia ao servidor (provável perda ao recarregar).
- Acervo e Corp mostram linhas/produções de demonstração numa empresa nova (Acervo exibe
  “Total de arquivos 0” com 8 linhas).

## Arquivos

`scripts/e2e.ps1`, `tests/e2e/{package.json,package-lock.json,.npmrc,playwright.config.js,no_dotenv.py,seed_e2e.py}`,
`tests/e2e/support/{fixtures.js,media.js,production.js}`, `tests/e2e/specs/01…07-*.spec.js`.

## Instalar por fora

- Nada obrigatório além do que já existe (Docker Desktop, Chrome, Node, Python 3.12 do Anaconda).
- Opcional: **FFmpeg no PATH** (ou `FFMPEG_PATH`) para a exportação MP4 da Timeline e a medição de
  duração (ffprobe). Sem ele o cenário 4a verifica a mensagem honesta de indisponibilidade.

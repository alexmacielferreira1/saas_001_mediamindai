# MediaMind AI

Bootstrap local em andamento. Backend FastAPI e PostgreSQL independentes; frontend Base44 preservado. **M0 ainda não aprovado:** ver `docs/PROJECT_STATUS.md`, `docs/FRONTEND_BASELINE.md` e `docs/TESTING_STRATEGY.md`.

## Uso no Windows

Abra PowerShell na pasta deste produto. Python 3.12, Node 24 e Docker Desktop em funcionamento são necessários. O setup baixa dependências na primeira preparação.

```powershell
.\scripts\setup.ps1
.\scripts\dev.ps1
.\scripts\smoke.ps1
.\scripts\check.ps1
.\scripts\stop.ps1
```

`check` pode retornar erro: ele registra todos os gates, incluindo falhas herdadas do frontend. Não ignorar esse resultado para avançar a M1.

## Endereços desta máquina

- Frontend: http://127.0.0.1:5173
- API: http://127.0.0.1:8000
- Documentação da API: http://127.0.0.1:8000/docs
- PostgreSQL: 127.0.0.1:5433

Configurações ficam no .env local, ignorado pelo Git.

`/health` verifica se a API está viva; `/ready` testa o banco de verdade; `/version` identifica produto e versão. As telas ainda não consomem este backend. A abertura do login não comprova autenticação real nem funções migradas.

## Comandos disponíveis

| Comando em scripts/ | Efeito |
|---|---|
| setup.ps1 | Verifica ferramentas, prepara dependências, preserva .env existente, sobe PostgreSQL e aplica migrations |
| dev.ps1 | Inicia banco, API e Vite locais; recusa portas de outros processos |
| stop.ps1 | Para somente processos registrados deste projeto e seu PostgreSQL; mantém dados |
| test-fast.ps1 | Testes locais sem dependência de banco |
| test.ps1 | Testes completos, incluindo PostgreSQL (banco deve estar ativo e migrado) |
| lint.ps1 | Verifica estilo Python e lint original do frontend |
| check.ps1 / readiness.ps1 | Executa gates, registra logs e atualiza estado, sem esconder falhas |
| smoke.ps1 | Confere API, conexão ao banco e resposta HTTP do frontend iniciado |
| migrate.ps1 | Aplica migrations ao banco configurado |
| build.ps1 | Compila o frontend preservado |
| reset-db.ps1 | Operação destrutiva separada; recusa execução sem confirmação explícita do nome do projeto |

Não executar reset-db por rotina. O banco persiste no volume do Docker. Logs/PIDs ficam em `.runtime/` e não entram no Git.

## Retomada e origem

Ler `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT_WORKFLOW.md` e `docs/PROJECT_STATUS.md`. No workspace completo, o acompanhamento geral está em `../_documentacao/RETOMADA.md`.

Git local: branch `bootstrap/m0`, snapshot original `base44-export`; nenhum remoto configurado. O README dentro de frontend/ pertence ao export e descreve publicação Base44 histórica; não é instrução de publicação deste bootstrap.

# Dependências

Python 3.12.10 e Node 24.19.0 usados nesta máquina. PostgreSQL 16 via Docker Compose, banco por produto. `pyproject.toml` declara faixas; `requirements.lock` registra versões Python exatas instaladas. `setup` instala pelo lock e depois o projeto local sem resolver dependências novamente.

Backend: FastAPI, Uvicorn, SQLAlchemy 2, Pydantic Settings, psycopg e Alembic. Testes/verificação: pytest, httpx e ruff. Ver lock para versões e transitivas.

Frontend: `package.json` e `package-lock.json` originais; 629 pacotes instalados com npm ci --ignore-scripts. SDK/plugin Base44 preservados. Instalação e build locais verificados; não foi executado npm audit fix nem atualização do export.

Limitações: TestClient/Starlette emitem dois avisos de depreciação ligados a httpx/anyio; testes passaram. Build frontend relata ausência de configuração Base44, bundles grandes e outros avisos registrados nos logs. A cadeia de dependências não recebeu auditoria completa de segurança neste M0; não é aprovação de produção.

Workflow CI preparado, mas ainda não executado no GitHub (sem remoto). Não alegar CI verde com base em teste local.

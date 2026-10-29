# MediaMind na intranet (servidor da emissora)

Um computador da emissora roda o MediaMind. Os outros abrem pelo navegador, pelo nome ou IP dele. Não precisa de internet nem de serviço pago.

## 1. Instalar (uma vez, no servidor)
1. Instale o Docker Desktop, o Python 3.12, o Node 24, o ffmpeg e o Ollama.
   - Para o ffmpeg e o Ollama, veja `docs/PLANO_VERSAO_LOCAL_2026-10-27.md`.
   - Baixe os modelos de IA:
     ```
     ollama pull llama3.1:8b
     ollama pull llama3.2:3b
     ```
2. Na pasta do projeto, rode `scripts/setup.ps1`. Depois instale o Whisper:
   ```
   .venv\Scripts\python -m pip install -r requirements-ia-local.txt
   ```
3. No `.env`, além do que já existe, configure:
   ```
   AI_SECRET_KEY=<chave Fernet; sem ela o modo intranet não sobe>
   MEDIA_ROOT=D:\MediaMind\midia
   INGEST_SOURCE_ROOT=D:\MediaMind\entrada
   EXPORT_ROOT=D:\MediaMind\destino
   OUTBOUND_ALLOWED_HOSTS=127.0.0.1:11434
   ```
   - `MEDIA_ROOT` é o Acervo, `INGEST_SOURCE_ROOT` é a pasta de referência e `EXPORT_ROOT` é a pasta de destino das peças prontas.
   - `OUTBOUND_ALLOWED_HOSTS` libera o Ollama.
   - Se já houver conexões de IA cadastradas, o script reaproveita a chave de `.runtime/ai-secret.key`. Ao fixar a `AI_SECRET_KEY`, use esse mesmo valor.
4. Libere a porta no Firewall do Windows. Rode no PowerShell como Administrador, uma vez só:
   ```
   New-NetFirewallRule -DisplayName 'MediaMind intranet' -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Domain,Private
   ```

## 2. Subir
Abra o Docker Desktop e rode:
```
docker compose up -d postgres
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/intranet.ps1 -Build
```
O script mostra os endereços para os outros computadores, como `http://servidor:8080` e `http://192.168.0.20:8080`.

O `-Build` compila a tela. Use-o na primeira vez e depois de cada atualização.

O modo `intranet`:
- não tem login de demonstração nem rotas sem senha;
- funciona em HTTP;
- serve a tela e a API no mesmo endereço, então o acesso pelo nome ou pelo IP funciona sem configuração extra.

## 3. Atualizar
```
git pull
.venv\Scripts\python -m pip install -r requirements.lock
.venv\Scripts\python -m alembic upgrade head
cd frontend; npx -y npm@11 ci; cd ..
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/intranet.ps1 -Build
```

## 4. Backup
- **Banco:** `scripts/backup-db.ps1` grava em `.runtime/backups/`. Para restaurar, use `scripts/restore-db.ps1`.
- **Mídias:** copie as pastas `MEDIA_ROOT` e `EXPORT_ROOT` (ex.: `robocopy D:\MediaMind E:\Backup\MediaMind /MIR`).
  - O backup do banco sem as mídias não basta, e o das mídias sem o banco também não.
- **Chave:** guarde a `AI_SECRET_KEY` fora do servidor. Sem ela, as conexões de IA precisam ser recadastradas.

## Problemas comuns
| Sintoma | Causa | O que fazer |
|---|---|---|
| "Ocorreu um erro interno" no login | Docker/PostgreSQL parado | Abrir o Docker Desktop e rodar `docker compose up -d postgres` |
| Abre no servidor, mas não nos outros computadores | Firewall | Regra do item 1.4 |
| O script para com erro de `AI_SECRET_KEY` | Chave não configurada | Item 1.3 |
| A tela não carrega (erro sobre `index.html`) | Tela não compilada | Rodar com `-Build` |

# Pendências para o chat responsável pela configuração de IA

Registradas em 20/10/2026 pela revisão de segurança (branch `fix/hub-p0-2026-10-20`). Os arquivos abaixo pertencem ao chat de IA e não foram alterados.

1. **SSRF com chave de IA** — `backend/app/api/v1/ai.py` (~74): o `base_url` configurável e o teste de conexão enviam a chave do provedor para qualquer destino. Usar `app.security.outbound.validate_outbound_url(base_url)` antes de qualquer requisição e no salvamento da conexão.
2. **Injeção de fórmula no CSV** — `backend/app/api/v1/ai_usage.py` (~162-173): aplicar `app.security.spreadsheet.safe_csv_row(row)` em cada linha antes do `DictWriter`.
3. **Orçamento furável por chamadas simultâneas** — o próprio código registra a corrida em `guard_budget`; usar bloqueio/consulta atômica.
4. **Lint/formatação** — 47 erros de `ruff check` em `ai.py` e `ai_usage.py` e 3 arquivos para `ruff format` (inclui `backend/tests/test_ai_api.py`); são o único motivo do gate `backend_quality` falhar.

Decisão de Alex (D1, 20/10/2026): as chaves de IA continuam dentro de cada SaaS; a Central terá apenas um espaço "Cofre de IA (futuro)".

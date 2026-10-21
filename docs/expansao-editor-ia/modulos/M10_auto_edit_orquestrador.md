# M10 — Auto Edit (orquestrador de 10 etapas)

Referência: `01_auto_edit_10_etapas.png`, `05_multicamera.png`.
"Um clique. Dez etapas. Edição pronta."

Implementar **por último**: o Auto Edit só chama as ferramentas já existentes (M01–M08), na ordem certa, com as mesmas funções de serviço (sem duplicar lógica).

## UI
Descrição: "Sincroniza as câmeras, analisa o áudio, remove silêncios, corta, cria as legendas animadas e os títulos e faz o ducking como um editor faria. Você só escolhe as etapas."

**Seção Etapas** ("na ordem em que rodam"), cada linha: número · nome · `?` (tooltip) · switch:
1. Sincronizar câmeras e áudio (M04)
2. Remover silêncios (M01)
3. Cortar vícios de linguagem (M06) → expande: Hesitações, Palavras repetidas
4. Detectar cortes (M02)
5. Corte multicâmera automático (M05) → expande: Pessoas/mic/câmera, câmera geral, ritmo, variar com geral
6. Auto Zoom (M08)
7. Criar legendas (M06)
8. Títulos animados (M06)
9. Auto Ducking (M03)
10. Normalizar áudio (M03)

Configuração compartilhada abaixo: Idioma do texto · Quantidade de títulos (Pouco/Médio/Muito) · Estilo (escolher template de legenda) — e cada etapa ligada mostra suas opções (reaproveitar os componentes das abas, em modo compacto).

Botão **▶ Executar Auto Edit** → **ConfirmDialog** ("Antes de mexer na timeline, o sistema guarda uma cópia da sequência") → progresso por etapa (lista com ✓ / em andamento / erro + %).
Ao fim: barra "Última ação: Auto Edit (HH:MM) · Desfazer" — **um botão desfaz tudo**.

Pré-requisitos automáticos: se etapa 3, 4 (modo SRT), 7, 8 precisarem de transcrição e ela não existir, rodar Transcrever antes (mostrar como etapa 0).

## Backend
- `auto_edit` job com subetapas; cada subetapa chama o serviço da ferramenta (analyze + apply) sobre a versão produzida pela anterior.
- **Transação de versões**: todas as subetapas criam versões filhas; ao final, registrar uma versão "Auto Edit" agregadora cujo `parent_id` é a versão anterior ao Auto Edit → Desfazer volta tudo de uma vez.
- Falha em uma etapa: parar, manter as anteriores aplicadas, mostrar erro e opção "Desfazer tudo" ou "Continuar das próximas".
- Presets de Auto Edit salvos pelo usuário (ex.: "Podcast 2 câmeras", "Reels falado").

## API
```
POST /editor-ia/auto-edit/run    { timeline_id, steps: {sync:{...}, silences:{...}, fillers:{...}, cuts:{...}, multicam:{...}, auto_zoom:{...}, captions:{...}, titles:{...}, ducking:{...}, normalize:{...}} }
GET  /editor-ia/jobs/{id}        → { stage: "silences", step_index: 2, progress, steps:[{name,status}] }
POST /editor-ia/auto-edit/presets / GET /editor-ia/auto-edit/presets
```

## Testes
- Execução com todas as etapas sobre fixture de podcast curto (2 mics, 2 câmeras, música).
- Desfazer único restaura a versão pré-Auto Edit idêntica.
- Etapas desligadas não rodam; ordem respeitada mesmo se a UI mandar fora de ordem.
- Erro simulado na etapa 6 → etapas 1–5 aplicadas, status correto.

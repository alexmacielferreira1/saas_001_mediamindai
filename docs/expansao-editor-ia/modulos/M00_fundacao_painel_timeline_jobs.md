# M00 — Fundação: painel, timeline versionada, jobs, undo

Referência: `17_painel_completo_abas.png` (e o topo de todos os prints).

## Objetivo
Criar a base que todas as ferramentas usam. Sem ela, cada ferramenta vira código duplicado.

## Frontend — Shell do painel
- Cabeçalho: ícone + "Editor IA" + versão, campo **Buscar ferramentas, sons, templates…**, seletor de idioma (PT/EN), engrenagem (configurações).
- Abas (ícone + nome, aba ativa com borda/realce laranja): Todos · Favoritos · Auto Edit · Silêncios · Cortes · Sound FX · Legendas · Transcrição · Áudio · Sincronizar · Motion Presets · Animação de texto · Presets e transições · Configurações.
  - Modo compacto (painel estreito): só ícones, nome aparece na aba ativa.
  - Favoritar aba/ferramenta (estrela); "Todos" = grade de cards de ferramentas.
- **Barra "Última ação: <nome> (HH:MM) · Desfazer"** fixa abaixo das abas quando houver ação.
- Texto descritivo curto no topo de cada ferramenta.
- Rodapé fixo:
  - Botões: **Transcrever** · **Importar SRT** · **Legendas**
  - Info da sequência: `Seq · 1920×1080 · 30 fps · 36.5s`
  - Chips de trilha alvo (ex.: `A3 SFX`, `V2`) — clicáveis para escolher a trilha de saída.
- Componentes compartilhados (`shared/`): `Section` (card com título laranja + ícone), `ToggleRow` (título + descrição + switch), `SliderField` (rótulo, `?` tooltip, valor à direita), `StepperField` (− valor + unidade), `ChipGroup` (ex.: dB, ritmo), `ResultList` (checkbox por item, timecode, badge), `Waveform` (canvas, regiões coloridas), `JobProgress`, `ConfirmDialog`.

## Backend — Modelo de timeline
- Tabelas (ou JSONB versionado; seguir o que o projeto já usa):
  - `timeline` (id, project_id, fps, width, height, duration, current_version_id)
  - `timeline_version` (id, timeline_id, parent_id, created_at, action_name, data JSONB, created_by)
  - `data`: trilhas `V1..Vn` / `A1..An` (tipo, nome, travada, mutada, papel: voz/música/sfx/câmera), clipes (asset_id, in, out, start, enabled, gain_db, keyframes_volume[], effects[], transform{}), legendas/títulos (template_id, texto, start, end, style overrides).
- Operações atômicas puras (testáveis sem banco): `split`, `ripple_delete_ranges(ranges, tracks_desbloqueadas)`, `set_gain`, `add_volume_keyframes`, `insert_clip`, `disable_clip`, `apply_effect`, `apply_transform_keyframes`.
- Toda aplicação de ferramenta = nova `timeline_version` com `action_name`. Undo = mover `current_version_id` para `parent_id`. "Backup automático" = a própria versão anterior (e opção de duplicar como nova timeline).

## Backend — Jobs
- Se já existir fila (Celery/RQ/arq/BackgroundTasks), reaproveitar. Senão: tabela `job` (id, type, status, progress 0–100, stage, result JSONB, error, timestamps) + worker.
- `GET /editor-ia/jobs/{id}` → `{status, progress, stage, result}`; front faz polling (ou SSE).
- Cache de análise por asset: áudio extraído, envelope RMS, loudness, transcrição por palavra.

## API
```
GET    /editor-ia/timelines/{id}                 → timeline atual + metadados para o rodapé
GET    /editor-ia/timelines/{id}/versions        → histórico
POST   /editor-ia/timelines/{id}/undo
POST   /editor-ia/timelines/{id}/duplicate       → backup como nova timeline
GET    /editor-ia/jobs/{id}
```

## Testes
- Unitários das operações atômicas (split no meio, ripple delete preservando trilhas travadas, keyframes).
- Undo/redo de 3 ações em sequência.
- Job: criação, progresso, erro propagado.
- Front: render do shell, troca de aba, barra de desfazer aparece após ação.

## Aceite
- Painel navegável com todas as abas (as ainda não implementadas mostram "em breve" — sem botão falso).
- Qualquer ferramenta consegue: criar job → mostrar progresso → aplicar → desfazer.

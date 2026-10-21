# M06 — Transcrição, vícios de linguagem, legendas e títulos animados

Referência: `08_legendas_templates.png`, `09_legendas_retranscrever.png`, `01_auto_edit_10_etapas.png`, `05_multicamera.png`.
"Legendas no estilo dos virais, em 4 passos."

## 6.1 Transcrição (base de tudo)
- Botão fixo do rodapé **Transcrever** e **Importar SRT**.
- Whisper (ou faster-whisper) com `word_timestamps=True`, idioma automático ou escolhido.
- **Progresso real por segmento** (corrige o travamento conhecido do Whisper no MediaMind): `progress = fim_do_segmento / duração`.
- Persistir: `transcript` (timeline_id/asset_id, idioma, segmentos, palavras {text, start, end, prob}).
- Importar SRT: parser → mesmos segmentos (palavras estimadas por divisão proporcional).

## 6.2 Cortar vícios de linguagem
UI (seção dentro da aba Transcrição e etapa do Auto Edit):
- Toggle **Hesitações** — "ãh, é…, hum, hmm, ahn" (lista editável por idioma)
- Toggle **Palavras repetidas** — "'eu eu', 'que que': tira a primeira"
- Analisar → lista com checkbox (timecode, palavra, contexto) → Aplicar (ripple delete com margens de M01).

Backend: varrer palavras; hesitação = token na lista (normalizado, sem acento/pontuação) ou palavra de baixa prob. muito curta; repetição = n-grama (1–3) idêntico consecutivo → remover a primeira ocorrência.

## 6.3 Legendas (4 passos)
1. **Transcrição** (ou SRT)
2. **Formato**: `Palavra por palavra (estilo TikTok/Reels)` | `Até N linhas` (1–6) + máx. caracteres por linha; idioma do texto.
3. **Estilo** — abas: `Biblioteca` | `Da timeline` (copiar estilo de uma legenda já na timeline) | `Legenda nativa`
   - Biblioteca: pastas com contagem (Todos, Bold, Glitch, Minimal, TikTok, YouTube…), busca, botões +/atualizar/zoom da grade, cards com prévia animada (ex.: "9×16 Pop Words", "Karaoke Yellow", "Lower Third Clean").
   - Template selecionado: nome, fonte, proporção; campos de texto do template (Linha 1…) mapeáveis; toggle **Apagar campos de texto não usados**.
   - **Aviso de fonte não instalada** + seletor **Fonte** (fontes disponíveis no sistema/projeto) com reset — "Troca só a fonte; cores, animação e o resto do design continuam iguais."
   - Controles expostos pelo template: Fill/Stroke color, Size, Paragraph align, Box on/off, posição.
   - Garantia: **nenhuma linha estoura a tela**, inclusive em 9:16 (medir texto e quebrar/reduzir).
4. **Criar legendas** → itens de legenda na trilha de legendas.

**Re-transcrever legendas**: troca as legendas existentes pelo template escolhido agora, mesmos tempos e trilha. Texto: `Das legendas atuais` (mantém correções manuais) | `Da transcrição`.

Template de legenda (formato do MediaMind, substitui MOGRT):
```json
{ "id": "pop-words-9x16", "name": "9×16 Pop Words", "folder": "TikTok", "aspect": "9:16",
  "font": {"family": "Heebo", "weight": 700}, "fill": "#FFD43B", "stroke": {"color":"#000","width":6},
  "box": {"enabled": true, "color": "#000000AA", "radius": 8}, "size": 140, "align": "center",
  "position": {"x": 0.5, "y": 0.72}, "fields": ["line1"],
  "animation": {"in": "pop", "word_highlight": "scale", "out": "fade"} }
```
Renderizado no player (CSS/canvas) e no export (ASS via libass / overlay FFmpeg).

## 6.4 Títulos animados
- Selecionar automaticamente as frases de maior impacto: LLM ou heurística (números, superlativos, palavras de ênfase, pausas antes/depois, energia de voz). Quantidade: Pouco/Médio/Muito.
- Inserir como título (template de título, M09) na trilha de texto, em destaque.

## API
```
POST /editor-ia/transcribe           { timeline_id|asset_id, language? }   → job
POST /editor-ia/transcript/import-srt  (multipart)
POST /editor-ia/fillers/analyze      { timeline_id, hesitations, repeats }
POST /editor-ia/fillers/apply        { timeline_id, word_ids[] }
GET  /editor-ia/caption-templates?folder=&q=
POST /editor-ia/captions/create      { timeline_id, template_id, mode, max_lines, overrides }
POST /editor-ia/captions/retranscribe{ timeline_id, template_id, source: "current"|"transcript" }
POST /editor-ia/titles/highlights    { timeline_id, amount, template_id }
```

## Testes
- Progresso do Whisper cresce monotonicamente até 100.
- "eu eu fui" → remove o primeiro "eu"; "hum" removido; palavra normal preservada.
- Nenhuma linha excede a largura útil em 1080×1920.
- Re-transcrever preserva start/end e texto corrigido manualmente.

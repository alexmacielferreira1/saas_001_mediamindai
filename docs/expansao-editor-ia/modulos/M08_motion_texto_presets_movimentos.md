# M08 — Motion: animação de texto, motion presets, movimentos rápidos, Auto Zoom

Referência: `14_animacao_texto.png`, `15_motion_presets.png`, `16_movimentos_rapidos.png`, `01_auto_edit_10_etapas.png`.
"Movimento em tudo, sem abrir o After Effects."

Fluxo comum: **selecionar na timeline → escolher a animação → prévia ao passar o mouse → aplicar**.
Todos os presets são dados (JSON de keyframes), não código, para crescer o catálogo sem deploy.

## 8.1 Animação de texto (+150 animações como meta de catálogo)
- Seleciona títulos/legendas e troca por versões animadas; **texto, fonte, tamanho, cor e posição continuam os mesmos**; mesmo lugar e mesma duração.
- Estilos-base: Fade, Position, Scale, Skew, Tracking, Decode (embaralha caracteres), Rotate e combinações; granularidade por texto inteiro / palavra / caractere.
- Prévia ao passar o mouse (player renderiza a animação no item selecionado).

Formato:
```json
{ "id": "decode-in", "name": "Decode", "category": "texto", "unit": "char",
  "in":  {"duration_ms": 600, "stagger_ms": 25, "tracks": {"opacity":[[0,0],[1,1]], "decode": true}},
  "out": {"duration_ms": 300, "tracks": {"opacity":[[0,1],[1,0]]}}, "easing": "easeOutCubic" }
```

## 8.2 Motion Presets (entradas e saídas em clipes)
- Presets: Rotação 2D/3D, Blur, Flicker, Glitch, Position (slide), Scale, Shake.
- Modo: **Entrada** | **Saída** | **Entrada + Saída**; duração ajustável.
- Aplicado sozinho em cada clipe selecionado; **aparado para nunca passar do fim do clipe** (se clipe < in+out, escalar proporcionalmente).

## 8.3 Movimentos rápidos
- Zoom suave · Punch in · Camera shake · Pan · Rotação · Motion blur
- **Intensidade 1–10** (slider) mapeada para amplitude (ex.: zoom suave 5 → 100%→110% na duração do clipe; punch in → salto de escala com 2 frames de ease; shake → ruído Perlin de posição/rotação).
- **Clonar estilo**: copiar Movimento (transform), Opacidade, Cor (equivalente ao Lumetri: o color grade/LUT aplicado) e efeitos de um clipe e colar em vários — com valores e keyframes (tempo relativo à duração do clipe destino, opção absoluta).

## 8.4 Auto Zoom (etapa do Auto Edit)
- Zoom rápido/médio/suave em alguns takes: escolher pontos de ênfase (palavras fortes / início de frases longas) e aplicar zoom suave ou punch in, com espaçamento mínimo e % de clipes afetados.
- Se houver detecção de rosto/pessoa (YOLO já previsto no MediaMind), centralizar o zoom no rosto.

## Backend / Render
- `clip.transform_keyframes` e `clip.effects[]` no modelo da timeline.
- Renderer: `scale`/`crop`/`zoompan`/`rotate`/`gblur`/`overlay` com expressões por tempo; texto via libass (ASS com tags `\t`, `\fscx`, `\blur`, `\alpha`) ou renderização de frames com Pillow/Skia para animações por caractere (Decode).
- Preview no front: aplicar os mesmos keyframes via CSS transforms/canvas no player (paridade visual aproximada é aceitável; export é a fonte da verdade).

## API
```
GET  /editor-ia/motion/presets?type=text|clip|move&q=
POST /editor-ia/motion/apply       { timeline_id, item_ids[], preset_id, mode?, intensity?, duration_ms? }
POST /editor-ia/motion/clone-style { timeline_id, source_clip_id, target_clip_ids[], parts:["transform","opacity","color","effects"], timing:"relative"|"absolute" }
POST /editor-ia/motion/auto-zoom   { timeline_id, style:"fast"|"medium"|"smooth", amount }
```

## Testes
- Texto mantém fonte/tamanho/cor/posição após aplicar animação.
- Preset de saída nunca ultrapassa o fim do clipe; clipe curto escala in/out.
- Clonar estilo em 3 clipes de durações diferentes → keyframes proporcionais.

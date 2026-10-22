# M09 — Packs: transições, looks, LUTs, títulos, créditos, multi-tela

Referência: `10_packs_destaques.png`, `11_packs_transicoes.png`. "O som do efeito vem junto."

## UI (aba "Presets e transições")
- Filtros em chips com contagem: Destaques · Transições · Animações · Color/LUTs · Looks · Motion · Câmera · Cortes · Textos · Títulos · Multi-tela · Créditos.
- Grade de cards com **prévia em vídeo** (loop curto ao passar o mouse; ▶ no card destaque), rótulo do pack em laranja + nome do preset.
- Seções agrupadas: **Efeitos visuais (N packs)** e **Sons e trilhas (N packs)**, cada pack com ícone, nome e quantidade.
- Aplicar: no clipe selecionado / entre os dois clipes selecionados (transição) / no playhead (títulos, créditos).
- **Som acompanha o efeito**: transição/efeito pode ter `sfx_id` vinculado, inserido na trilha de SFX junto (toggle global).

## Tipos de preset e como renderizar
| Tipo | Representação | Render (FFmpeg) |
|---|---|---|
| Transição | `{type, duration_ms, params}` entre clipes A/B | `xfade` (fade, wipe, slide, zoomin, pixelize, dissolve…) ou filtros customizados (spin/warp/glitch via `rotate`, `scale`, `rgbashift`, `noise`) |
| Color/LUT | arquivo `.cube` + intensidade | `lut3d` + `blend` para intensidade |
| Look | cadeia de filtros (VHS, film, light leak) | `noise`, `curves`, `chromashift`, `overlay` de textura em loop |
| Câmera | keyframes de transform (reaproveita M08) | ver M08 |
| Corte com efeito | flash/light leak curto no ponto de corte | `overlay` de clipe de efeito |
| Título / Crédito | template de texto (M06/M08) | libass/overlay |
| Multi-tela | layout (2, 3, 4 telas; 9:16) com slots | `xstack`/`overlay` |

## Backend
- Tabela `preset` (id, type, pack, name, category, thumbnail_url, preview_url, data JSONB, sfx_id?, license, featured).
- Gerar prévias automaticamente: renderizar o preset sobre 2 clipes de amostra próprios → MP4 curto + thumbnail (job em lote, cacheado).
- Packs como seeds versionados no repositório (JSON + assets), não hardcoded no front.

## API
```
GET  /editor-ia/presets?type=&category=&featured=&q=
GET  /editor-ia/packs
POST /editor-ia/presets/apply { timeline_id, preset_id, target: {clip_ids[]|between:[a,b]|at_ms}, with_sfx }
```

## Conteúdo
Catálogo inicial pequeno e real (ex.: 5 por categoria, como na referência) criado por nós; LUTs só livres/licenciados. A referência é inspiração de UX, não fonte de assets.

## Testes
- Transição altera duração total conforme regra escolhida (overlap) e não quebra sincronia áudio/vídeo.
- LUT com intensidade 0 = imagem original.
- Prévia gerada para todo preset com `featured=true`.

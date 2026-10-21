# M07 — Sound FX: biblioteca com prévia + SFX automático

Referência: `06_sound_fx_automatico.png`, `12_sfx_pads_previa.png`, `13_sfx_timeline_biblioteca.png`.
"O som certo, no lugar certo."

## 7.1 Biblioteca (sub-aba "Biblioteca")
- Chips de categoria com contagem: Whoosh, Hit, Impact, Rise, Transition, Bass drop, Click, Glitch, Pop, Swoosh, UI, Cinematic…
- Busca ("whoosh, impact, glitch…").
- Lista: checkbox · ▶ prévia · nome · pacote/origem · select de categoria (editável) · duração · ☆ favorito · ＋ inserir no playhead.
- **Adicionar pastas de sons próprias** (upload em lote do usuário → categorização automática).
- Categorização automática: pelo nome do arquivo/pasta (palavras-chave) + fallback por features de áudio (duração, envelope de ataque, centroide espectral). Usuário pode corrigir a categoria.
- Página/ seção de pads de prévia (`12_sfx_pads_previa.png`) é opcional para landing/demo; no app basta a lista.

## 7.2 SFX automático (sub-aba "SFX automático")
Descrição: "Lê os cortes, os textos e as palavras fortes da timeline e escolhe um som para cada momento. Os sons se alternam para não repetir."

**Categorias usadas**: chips ligáveis com contagem disponível (desabilitado se 0).

**Quando tocar** (toggles):
- **Cortes e transições** — whoosh/swoosh um pouco antes de cada troca de clipe.
- **Entrada de textos e títulos** — click/pop; hit se o template for de impacto; glitch se for glitch (usar tags do template).
- **Palavras fortes na fala** — hit/impact em números e palavras de ênfase (transcrição M06).

Parâmetros: Espaço mínimo entre sons (s) slider, padrão 0.8 · Volume dos SFX (dB) padrão −6 · Nome da trilha de SFX (padrão "SFX").
Botões: **Preview** (proposta marcada na timeline, sem aplicar) · **Limpar SFX** · **Gerar SFX**.

## Backend
- Catálogo: tabela `sfx` (id, file, name, category, tags, duration, peak_offset_ms, pack, owner_id, favorite).
- `peak_offset_ms` (momento do pico) calculado na ingestão → o som é posicionado para o pico cair no evento (whoosh termina no corte).
- Eventos: trocas de clipe (V1), entradas de texto/título, palavras fortes (regras: números, lista de ênfase por idioma, opcional LLM).
- Seleção: por categoria do evento, **rotação sem repetir** o mesmo arquivo consecutivamente; aplicar espaço mínimo (prioridade: palavra forte > texto > corte).
- Inserir na trilha de SFX (criar se não existir) com `gain_db` = volume.

## API
```
GET  /editor-ia/sfx?category=&q=&favorites=
POST /editor-ia/sfx/upload            (multipart, pasta)
PATCH /editor-ia/sfx/{id}             { category, favorite }
POST /editor-ia/sfx/auto/preview      { timeline_id, categories[], on_cuts, on_text, on_strong_words, min_gap_s, volume_db, track_name }
POST /editor-ia/sfx/auto/apply        { timeline_id, proposal_id }
POST /editor-ia/sfx/clear             { timeline_id, track_name }
```

## Conteúdo
Popular o catálogo inicial só com sons próprios, CC0 ou licenciados (ex.: Freesound CC0, Pixabay, Mixkit — verificar licença de cada um). Nunca copiar packs comerciais.

## Testes
- Nenhum par de SFX mais próximo que o espaço mínimo.
- Mesmo arquivo nunca usado duas vezes seguidas quando a categoria tem ≥ 2 arquivos.
- Pico do whoosh alinhado ao corte ± 1 frame.
- Limpar SFX remove só a trilha de SFX.

# M02 — Cortes (detectar pontos de corte)

Referência: `04_cortes.png`. "Cortes naturais, sem apagar nada."

## UI
Descrição: "Encontra pontos de corte naturais e divide os clipes, sem apagar nada. Confira a lista antes de aplicar."

**Seção Detecção**
- Cortar em: `Pausas na fala` | `Fim de frase (SRT/transcrição)` | `Mudança de cena`
- Sensibilidade 1–10 (padrão 5).

**Seção Precisão**
- Pausa mínima (s): 0.25
- Clipe mínimo (s): 1.5 — "Nunca cria clipes menores que isso."
- Margens de segurança (ms): antes 80, depois 80 — "O corte fica dentro da pausa, respeitando essas margens."

Botão **Analisar cortes** → "**8** cortes detectados" + `ResultList`: checkbox · timecode `00:00:02.400` · descrição ("pausa de 0.76s" / "fim de frase" / "mudança de cena") · badge do tipo. Clique no item = mover playhead.
Botão **Aplicar cortes selecionados**.

## Backend
- Pausas: reaproveitar envelope de M01; ponto de corte = centro da pausa ajustado pelas margens.
- Fim de frase: pontuação final nos segmentos/palavras da transcrição (M06) ou SRT importado.
- Mudança de cena: PySceneDetect (`ContentDetector`, threshold derivado da sensibilidade) ou `ffmpeg select='gt(scene,X)'`.
- Pós-processamento: remover pontos que gerem clipe < clipe mínimo (manter o de maior pausa/score).
- Aplicar: apenas `split` em todas as trilhas destravadas. Nada é removido.

## API
```
POST /editor-ia/cuts/analyze { timeline_id, mode, sensitivity, min_pause_s, min_clip_s, pad_before_ms, pad_after_ms }
POST /editor-ia/cuts/apply   { timeline_id, cut_points_ms[] }
```

## Testes
- Nenhum clipe resultante < clipe mínimo.
- Contagem de clipes = pontos aplicados + 1 (por trilha afetada); duração total inalterada.
- Modo SRT com SRT de fixture.

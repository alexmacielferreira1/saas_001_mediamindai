# M01 — Silêncios

Referência: `03_silencios.png`, `17_painel_completo_abas.png`.
"Silêncio fora, sincronia intacta."

## UI
Descrição: "Detecta silêncios pelo volume do áudio e remove os trechos fechando os buracos em todas as trilhas destravadas."

**Seção Onde cortar**
- Trecho da timeline: `Sequência inteira` | `Entre marcadores In/Out` | `Clipes selecionados`
- Trilha analisada: `Automático (voz)` | lista de trilhas de áudio. Ajuda: "Com música de fundo, analise só a trilha da voz."
- Toggle **Não cortar a música** (padrão ON): trilha de música continua inteira; trilhas travadas também são preservadas.
- Toggle **Backup automático** (padrão ON): duplica a sequência antes de qualquer alteração.

**Seção Precisão do corte**
- Sensibilidade 1–10 (padrão 5) — mapeia para o limite automático.
- Silêncio mínimo (s) stepper, padrão 0.50.
- Limite de volume: `Automático` | `Manual` + stepper dB (padrão −40). No resultado mostrar o limite efetivo (ex.: "limite −52.2 dB").
- Margens de segurança (ms): antes 120, depois 150. Ajuda: "Aumente se as palavras estiverem sendo cortadas."

Botão **Analisar** → resultado: "**6** silêncios encontrados · 4.2s no total" + **Waveform** com regiões de silêncio em vermelho; cada ajuste recalcula na hora (sem novo job, usando o envelope RMS cacheado).
Botão **Remover silêncios** (com ConfirmDialog).

## Backend
1. Extrair áudio mono 16 kHz da trilha analisada (cache por asset).
2. Envelope RMS em janelas de 10 ms → dBFS.
3. Limite automático: percentil do ruído de fundo (ex.: P15 do envelope) + offset derivado da sensibilidade; limite manual sobrescreve.
4. Regiões abaixo do limite com duração ≥ silêncio mínimo; encolher cada região pelas margens (antes/depois); descartar regiões que ficarem ≤ 0.
5. Retornar envelope decimado (para waveform) + regiões + limite efetivo.
6. Aplicar: `ripple_delete_ranges` em todas as trilhas destravadas, exceto música se o toggle estiver ON (vídeo, voz, títulos e SFX andam juntos).

Alternativa válida para o passo 2–4: `ffmpeg -af silencedetect=noise=XdB:d=Y` — mas o envelope próprio é necessário para o recálculo instantâneo no front.

## API
```
POST /editor-ia/silences/analyze { timeline_id, range, track, sensitivity, min_silence_s, threshold_mode, threshold_db, pad_before_ms, pad_after_ms }
POST /editor-ia/silences/apply   { timeline_id, regions[], keep_music, backup }
```

## Testes
- Áudio sintético (tom + silêncios conhecidos) → regiões corretas ± 10 ms.
- Margens nunca invertem a região; silêncio mínimo filtra.
- Trilha travada e trilha de música intactas após apply; duração final = original − soma das regiões.
- Undo restaura exatamente.

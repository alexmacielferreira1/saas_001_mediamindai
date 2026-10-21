# M03 — Áudio: Auto Ducking + Normalizar

Referência: `07_audio_ducking_normalizar.png`. "Música abaixo, voz no nível."

Aviso fixo na aba: "Ducking e normalização trabalham só com keyframes e ganho do clipe. Seus arquivos de áudio não são alterados."

## Auto Ducking — UI
- Trilha de voz: `Detectar automaticamente` | lista
- Trilha de música: `Detectar automaticamente` | lista
- Quanto abaixar (chips): −6 · −9 · **−12** · −15 · −18 dB
- Ataque (ms): 100 · Retorno (ms): 300
- **Analisar** → "**6** trechos de voz em A1 (86% do tempo) · música em A2"
- **Aplicar ducking**

## Auto Ducking — Backend
- Detecção automática de papéis: VAD/energia + espectro (voz: energia concentrada 300–3400 Hz, intermitente; música: contínua, banda larga). Usar o `role` da trilha se já marcado.
- Trechos de voz = regiões acima do limite (reaproveitar M01) com fusão de gaps < 400 ms.
- Gerar keyframes de volume na música: para cada trecho, rampa de 0 → −X dB em `ataque` antes do início, mantém, rampa de volta em `retorno` após o fim. Mesclar rampas sobrepostas.

## Normalizar — UI
- Trilha: `Detectar automaticamente` | lista
- Nível alvo da fala (slider): padrão −18 dB (LUFS de fala) — mostrar valor à direita
- **Analisar** (mostra loudness atual e ganho que será aplicado por clipe) → **Aplicar ganho**

## Normalizar — Backend
- Medir loudness integrado e true peak por clipe (`ffmpeg -af ebur128=peak=true` ou `pyloudnorm`).
- ganho = alvo − loudness; limitar para que `true_peak + ganho ≤ −1 dBTP`.
- Gravar em `clip.gain_db` (não renderiza nada).

## API
```
POST /editor-ia/audio/ducking/analyze { timeline_id, voice_track?, music_track? }
POST /editor-ia/audio/ducking/apply   { timeline_id, reduce_db, attack_ms, release_ms }
POST /editor-ia/audio/normalize/analyze { timeline_id, track?, target_db }
POST /editor-ia/audio/normalize/apply   { timeline_id, gains[] }
```

## Render
O renderer (M00) traduz `gain_db` → `volume=` e keyframes → `volume='...':eval=frame` (ou segmentos com `afade`/`volume`) no filtergraph.

## Testes
- Keyframes começam `ataque` ms antes da fala e terminam `retorno` ms depois.
- Nenhum pico pós-ganho acima de −1 dBTP.
- Arquivos de mídia originais com hash inalterado.

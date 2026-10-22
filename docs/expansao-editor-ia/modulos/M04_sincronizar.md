# M04 — Sincronizar (pela forma de onda)

Referência: `02_sincronizar.png`. "Câmeras e áudios alinhados sozinhos."

## UI
Descrição: "Coloque as câmeras e os áudios externos na timeline, em qualquer posição e em trilhas diferentes. O sistema escuta o som de cada um e alinha tudo com a referência."

**Seção Sincronizar pela forma de onda**
- Toggle **Usar só os clipes selecionados** — "Sem nada selecionado, usa todos os clipes da sequência."
- Toggle **Desativar o áudio das câmeras** — "Quando houver áudio externo (gravador, lapela), fica só ele ligado."
- Botões **Analisar** | **Sincronizar N**

**Resultado**: "**2/3** fontes sincronizadas com a referência" + lista:
- rádio (escolher referência) · checkbox (incluir) · nome do arquivo · `V1 · A1 · 00:00:10.000` · offset `+0,500 s` · badge `Confiança alta/média/baixa` (verde/amarelo/laranja) ou `Referência` ou `Não achou o mesmo som` (vermelho).
- Nota: "Clique no círculo para trocar a referência. Fontes sem som em comum com ela são alinhadas por outra fonte já sincronizada."
- Card informativo: "Depois, para editar em multicâmera…" → link para aba Multicâmera.

Referência automática: a fonte de áudio com melhor SNR / maior duração (gravador externo costuma vencer).

## Backend
1. Extrair áudio de cada fonte (mono, 8–16 kHz para busca grossa; 48 kHz para refinamento).
2. Pré-processar: high-pass ~100 Hz, envelope ou onset strength (robusto a eco/áudio de celular).
3. Correlação cruzada via FFT (`scipy.signal.correlate(method='fft')`) referência × fonte → offset grosso.
4. Refinar em janela ±50 ms na taxa cheia com interpolação parabólica do pico → precisão sub-amostra (< 1 ms).
5. Confiança = razão pico / segundo pico (ou pico normalizado): alta > 0.6, média 0.35–0.6, baixa 0.2–0.35, abaixo → "não achou".
6. **Sincronização em cadeia**: grafo de pares; fontes sem pico com a referência são alinhadas via outra fonte já sincronizada (caminho de maior confiança).
7. Aplicar: mover clipes (vídeo + áudio vinculados) pelo offset; opcionalmente mutar áudio das câmeras.

Vídeo alinhado ao quadro exato; áudio alinhado na amostra (guardar offset em amostras no modelo).

## API
```
POST /editor-ia/sync/analyze { timeline_id, clip_ids?, reference_clip_id? }
POST /editor-ia/sync/apply   { timeline_id, offsets: [{clip_id, offset_samples}], mute_camera_audio }
```

## Testes
- Fixture: mesmo áudio com offsets conhecidos (+0.5 s, −1.2 s) + ruído + eco simulado → erro < 1 ms.
- Fonte sem áudio em comum → "não achou"; com ponte por terceira fonte → alinhada em cadeia.
- Troca de referência recalcula sem novo upload.

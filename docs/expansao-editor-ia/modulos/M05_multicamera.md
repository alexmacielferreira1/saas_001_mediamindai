# M05 — Corte Multicâmera automático

Referência: `05_multicamera.png`, `01_auto_edit_10_etapas.png`. "Podcast com várias câmeras? Ele corta."

## UI
Descrição: "Para cada pessoa: a trilha do microfone dela e a trilha da câmera que mostra ela. As câmeras precisam estar sincronizadas, uma em cada trilha de vídeo."

- Linhas **Pessoa 1..4**: select Microfone (trilha de áudio) + select Câmera (trilha de vídeo). Botão **+ Adicionar pessoa** (máx. 4).
- Câmera geral: `Nenhuma (fica em quem falou por último)` | trilha de vídeo — "Usada quando duas pessoas falam juntas ou riem."
- Ritmo dos cortes (chips): Calmo · **Normal** · Rápido
- Toggle **Variar com a câmera geral** — "Em falas longas, mostra a geral por alguns segundos (a cada ~8 s)."
- Aviso se as câmeras não estiverem sincronizadas → botão para ir a Sincronizar.

## Backend
1. Envelope RMS por microfone a cada **10 ms** (reaproveitar M01).
2. Compensar vazamento (bleed): normalizar cada mic pelo seu ruído de fundo; falante ativo = mic com maior energia relativa acima do limite e com margem ≥ X dB sobre o segundo.
3. Estados por frame: pessoa N / ninguém / sobreposição (≥ 2 acima do limite).
4. Suavização (máquina de estados com histerese), parâmetros por ritmo:
   - Calmo: troca só após ≥ 2.0 s de fala nova; plano mínimo 3.0 s
   - Normal: ≥ 1.0 s; plano mínimo 1.8 s
   - Rápido: ≥ 0.5 s; plano mínimo 1.0 s
   - **Respostas curtas não trocam a câmera** (fala < limiar do ritmo é ignorada).
5. Sobreposição/risos → câmera geral (se definida); senão mantém quem falou por último.
6. "Variar com geral": em planos > 8 s, inserir 2–3 s da geral no meio.
7. Aplicar: na timeline, dividir clipes de todas as câmeras nos pontos de troca e **desativar** (não apagar) os planos fora do ar.

## API
```
POST /editor-ia/multicam/analyze { timeline_id, people:[{mic_track, cam_track}], wide_track?, pace, vary_wide }
POST /editor-ia/multicam/apply   { timeline_id, proposal_id }
```
Resultado da análise: lista de planos (início, fim, câmera) + estatística de tempo de tela por pessoa.

## Testes
- Fixture 2 mics sintéticos alternando falas → planos corretos; fala de 0.3 s não gera troca no ritmo Normal.
- Nenhum plano menor que o mínimo do ritmo.
- Nada apagado: soma de clipes (ativos + desativados) cobre a duração original em cada trilha de câmera.

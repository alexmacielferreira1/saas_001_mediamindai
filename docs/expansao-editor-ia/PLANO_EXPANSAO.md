# Plano de Expansão — Editor IA do MediaMind AI

## 1. Diagnóstico

A ferramenta aplicada no MediaMind AI cobre só uma fração do que as referências mostram.
As referências descrevem um **painel de edição assistida** com:

| Área | O que a referência entrega | Prints |
|---|---|---|
| Auto Edit | 10 etapas ligáveis, executadas em ordem, com confirmação e "desfazer tudo" | 01, 05 |
| Sincronizar | Alinha câmeras/áudios externos pela forma de onda, confiança por fonte, sincronização em cadeia | 02 |
| Silêncios | Remove pausas por volume, com sensibilidade, silêncio mínimo, limite dB, margens, preserva música/trilhas travadas, backup | 03, 17 |
| Cortes | Detecta pontos naturais (pausa / fim de frase SRT / mudança de cena), lista com checkbox, clipe mínimo, só divide | 04 |
| Multicâmera | Até 4 pessoas (mic+câmera) + câmera geral, quem fala a cada 10 ms, ritmo calmo/normal/rápido, variar com geral | 05 |
| Vícios de linguagem | Hesitações (ãh, é…, hum) e palavras repetidas ("eu eu") | 01, 05 |
| Sound FX | Biblioteca com prévia/categorias/favoritos + SFX automático (cortes, entrada de texto, palavras fortes), espaçamento mínimo, volume, trilha própria | 06, 12, 13 |
| Áudio | Auto ducking (−6 a −18 dB, ataque/retorno) e normalização (alvo −18 dB, pico < −1 dB) só via ganho/keyframes | 07 |
| Legendas | Transcrição → template de legenda (biblioteca/da timeline/nativa), palavra-a-palavra ou até 6 linhas, fonte/cor/caixa, re-transcrever | 08, 09 |
| Títulos animados | Frases de maior impacto em destaque | 01 |
| Motion | Animação de texto (+150), motion presets entrada/saída, movimentos rápidos (zoom/shake/pan 1–10), clonar estilo | 14, 15, 16 |
| Packs | Transições, animações, LUTs/color, looks, câmera, cortes, textos, títulos, multi-tela, créditos + packs de som, com prévia em vídeo | 10, 11 |
| Shell do painel | Abas por ferramenta, busca, favoritos, idioma, configurações, barra "Última ação/Desfazer", rodapé com dados da sequência e trilhas alvo, botões fixos Transcrever / Importar SRT / Legendas | 17 |

**Adaptação importante:** a referência é um plugin do Premiere. No MediaMind AI (React + Vite +
Tailwind/shadcn no front, FastAPI + PostgreSQL no back) o equivalente é:
- "Sequência do Premiere" → **Timeline/Projeto de edição** do MediaMind (modelo versionado em JSON/tabelas)
- "MOGRT" → **Template de legenda/título** (JSON de estilo + animação), renderizado no player e no export
- "Keyframes/ganho" → **automação de volume** no modelo da timeline, aplicada no render via FFmpeg
- Processamento pesado → **jobs no backend** (FFmpeg, Whisper, numpy/scipy, PySceneDetect)

## 2. Arquitetura-alvo

```
frontend/
  features/editor-ia/
    shell/            Painel com abas, busca, favoritos, barra de última ação, rodapé
    tools/<ferramenta>/  Um diretório por ferramenta (UI + hooks + api client)
    shared/           Waveform, ResultList(checkbox), SliderField, StepperField, DbChips, JobProgress
backend/
  app/editor_ia/
    timeline/         Modelo, versões (snapshots), operações atômicas (split, ripple delete, gain, keyframe, insert clip)
    jobs/             Fila + status/progresso (reaproveitar o que existir; senão tabela jobs + worker)
    analysis/         audio.py (RMS, silêncio, loudness), sync.py (correlação), scenes.py, speech.py (Whisper words)
    tools/            silences.py, cuts.py, ducking.py, normalize.py, sync.py, multicam.py, fillers.py, sfx.py, captions.py, motion.py
    library/          SFX, templates de legenda, presets de motion, LUTs/packs (catálogo + categorias + prévia)
    render/           Tradução do modelo da timeline para FFmpeg (filtergraph) para export/preview
```

Fluxo padrão de toda ferramenta:

```
POST /editor-ia/{tool}/analyze  → job_id  → GET /jobs/{id} (progresso)  → resultado (proposta)
POST /editor-ia/{tool}/apply    { timeline_id, proposal_id, itens_selecionados } → nova versão da timeline
POST /editor-ia/timeline/{id}/undo  → volta à versão anterior (barra "Desfazer")
```

## 3. Fases e ordem de execução

Cada fase = uma branch `feat/editor-ia-fX-nome`, commits pequenos, testes passando, doc atualizada.

| Fase | Conteúdo | Módulos | Depende de |
|---|---|---|---|
| F0 | Auditoria do que existe + Matriz de Gaps (sem código) | — | — |
| F1 | Fundação: modelo de timeline versionado, undo/backup, jobs com progresso, shell do painel | M00 | F0 |
| F2 | Áudio básico: Silêncios, Cortes, Ducking, Normalizar (+ componente Waveform) | M01, M02, M03 | F1 |
| F3 | Sincronizar + Multicâmera | M04, M05 | F2 |
| F4 | Transcrição por palavra, vícios de linguagem, Legendas com templates, Re-transcrever, Títulos animados | M06 | F1 |
| F5 | Sound FX: biblioteca com prévia + SFX automático | M07 | F2, F4 |
| F6 | Motion: animação de texto, motion presets, movimentos rápidos, clonar estilo, Auto Zoom | M08 | F1 |
| F7 | Packs: transições, LUTs/looks, títulos, créditos, multi-tela, com prévia | M09 | F6 |
| F8 | Auto Edit orquestrador (10 etapas) | M10 | F2–F6 |
| F9 | Polimento: i18n PT/EN, atalhos, favoritos, busca global, testes E2E, performance | todos | F8 |

Sugestão para hoje à noite: **F0 + F1 completas**, e começar F2 por Silêncios
(é o módulo que valida toda a fundação: análise → waveform → lista → aplicar → desfazer).

## 4. Riscos e decisões

- **Render**: se o MediaMind ainda não exporta a timeline editada, F1 precisa incluir um
  renderer mínimo (FFmpeg concat + filtros de volume). Sem isso, nenhuma ferramenta é "aplicável".
- **Performance**: análise de áudio em arquivos longos → extrair áudio mono 16 kHz (análise)
  e 48 kHz (sync/render) uma vez e cachear por asset.
- **Licenças**: SFX/LUTs/transições do catálogo devem ser próprios, CC0 ou licenciados —
  nunca copiar os packs da referência. A referência é só de UX/funcionalidade.
- **Whisper**: usar timestamps por palavra (`word_timestamps=True` / faster-whisper) e
  reportar progresso por segmento; isso destrava Cortes por SRT, vícios, legendas e SFX de palavras fortes.

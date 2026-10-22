# Pacote de Expansão — Editor IA do MediaMind AI

Pacote para expandir a ferramenta de edição automática já aplicada no MediaMind AI até o nível
de recursos das referências (painel estilo "FX Master Premiere": Auto Edit em 10 etapas,
Sincronizar, Silêncios, Cortes, Multicâmera, Sound FX, Áudio, Legendas, Motion e Packs).

## Como usar hoje à noite

1. Extraia este zip dentro do repositório, em:
   `MediaMindAI/docs/expansao-editor-ia/`
2. Abra o Claude Code na raiz do repositório.
3. Cole o conteúdo de `PROMPT_CLAUDE_CODE.md` como primeira mensagem.
4. O agente começa pela **Fase 0 (auditoria)**, preenche `checklists/MATRIZ_DE_GAPS.md`
   e só depois implementa, fase por fase, uma branch por fase.
5. Ao fim de cada fase, revise o PR / commits antes de liberar a próxima.

## Estrutura

```
expansao-editor-ia/
├── 00_LEIA_PRIMEIRO.md          ← este arquivo
├── PROMPT_CLAUDE_CODE.md        ← prompt para colar no Claude Code
├── PLANO_EXPANSAO.md            ← visão, arquitetura, fases e ordem de execução
├── modulos/                     ← especificação de cada ferramenta (UI, parâmetros, backend, API, testes)
│   ├── M00_fundacao_painel_timeline_jobs.md
│   ├── M01_silencios.md
│   ├── M02_cortes.md
│   ├── M03_audio_ducking_normalizar.md
│   ├── M04_sincronizar.md
│   ├── M05_multicamera.md
│   ├── M06_transcricao_vicios_legendas.md
│   ├── M07_sound_fx.md
│   ├── M08_motion_texto_presets_movimentos.md
│   ├── M09_packs_efeitos_luts_transicoes.md
│   └── M10_auto_edit_orquestrador.md
├── checklists/
│   ├── MATRIZ_DE_GAPS.md        ← agente preenche na Fase 0
│   └── DEFINICAO_DE_PRONTO.md   ← critérios para fechar cada módulo
└── referencias/                 ← 17 prints de referência (INDICE.md mapeia print → módulo)
```

## Princípios inegociáveis (valem para todos os módulos)

- **O código atual é a fonte de verdade.** Expandir o que existe, não recriar.
- **Não destrutivo.** Nenhuma ferramenta altera arquivo de mídia original; tudo opera
  sobre o modelo de timeline (versões/snapshots) e gera renders derivados.
- **Analisar → revisar → aplicar.** Toda ferramenta mostra o resultado da análise
  (lista com checkbox, waveform, contagem) antes de aplicar.
- **Desfazer sempre.** Barra "Última ação: X (hora) · Desfazer" + backup automático da sequência.
- **Sem mocks.** Dados reais do banco e da mídia já enviada.
- **Progresso real.** Todo job longo expõe status/percentual (corrige o problema do Whisper travado).

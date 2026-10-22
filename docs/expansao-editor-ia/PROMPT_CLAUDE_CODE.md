# Prompt para colar no Claude Code

> Extraia o zip em `docs/expansao-editor-ia/` na raiz do repositório antes de colar.

---

Você vai expandir a ferramenta de edição assistida por IA que já existe no MediaMind AI
(frontend React + Vite + Tailwind/shadcn; backend FastAPI + SQLAlchemy async + PostgreSQL + Alembic; testes com pytest/Factory Boy; `poetry run task format` e `poetry run task test`).

A especificação completa está em `docs/expansao-editor-ia/`. Leia nesta ordem antes de qualquer código:
1. `docs/expansao-editor-ia/00_LEIA_PRIMEIRO.md`
2. `docs/expansao-editor-ia/PLANO_EXPANSAO.md`
3. `docs/expansao-editor-ia/referencias/INDICE.md` e abra os prints em `referencias/` (são a referência visual e funcional)
4. Os arquivos de `modulos/` só quando for implementar cada um
5. `docs/expansao-editor-ia/checklists/DEFINICAO_DE_PRONTO.md`

## Regras
- O código atual é a fonte de verdade: audite → planeje → implemente incrementalmente → teste → corrija → documente.
- Expanda o que existe; não recrie componentes que já existem, não introduza mocks, não quebre fluxos existentes.
- Tudo não destrutivo: nunca alterar mídia original; operar sobre o modelo de timeline versionado, sempre com desfazer.
- Uma branch por fase (`feat/editor-ia-f<N>-<nome>`), commits pequenos e descritivos.
- Rode format + testes do backend e build/lint do frontend após cada arquivo relevante. Não diga que algo está pronto sem mostrar a saída dos testes.
- Se precisar de uma dependência nova (ffmpeg, faster-whisper, scipy, pyscenedetect, pyloudnorm…), verifique se já existe; se não, adicione via Poetry/npm e explique o motivo no commit.
- Assets de catálogo (SFX, LUTs, transições, templates) só próprios, CC0 ou licenciados. Os prints são referência de UX, não de assets nem de marca.
- Toda a comunicação comigo em português; código, nomes de variáveis e commits podem seguir o padrão do projeto.

## Tarefa de hoje

### Fase 0 — Auditoria (sem alterar código)
1. Mapeie onde a ferramenta de edição atual está (front e back): componentes, rotas, modelos, serviços, jobs, integração com Whisper/FFmpeg, export/render.
2. Preencha `docs/expansao-editor-ia/checklists/MATRIZ_DE_GAPS.md` (status ✅/🟡/❌, onde está, o que falta) para as 31 linhas.
3. Liste botões sem handler, mocks e dados ilustrativos encontrados na ferramenta.
4. Proponha ajustes ao plano se a arquitetura real exigir (ex.: já existe fila de jobs, já existe modelo de timeline).
5. **Pare e me mostre** a matriz + proposta antes de seguir.

### Fase 1 — Fundação (M00), após meu OK
Implemente `modulos/M00_fundacao_painel_timeline_jobs.md`: modelo de timeline versionado com operações atômicas puras e testadas, undo/backup, jobs com progresso real, shell do painel (abas, busca, favoritos, barra "Última ação/Desfazer", rodapé com Transcrever/Importar SRT/Legendas + info da sequência + trilhas alvo) e componentes compartilhados. Inclua o renderer mínimo se ainda não houver export da timeline.

### Fase 2 — começar por Silêncios (M01)
Se sobrar tempo, implemente `modulos/M01_silencios.md` de ponta a ponta (análise → waveform com recálculo instantâneo → aplicar → desfazer), validando a fundação.

Ao fim de cada fase: atualize a matriz, marque a Definição de Pronto e me entregue um resumo curto do que entrou, do que ficou pendente e dos próximos passos (M02 Cortes → M03 Áudio → M04 Sincronizar → M05 Multicâmera → M06 Legendas → M07 SFX → M08 Motion → M09 Packs → M10 Auto Edit).

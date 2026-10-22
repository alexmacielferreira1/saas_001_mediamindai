# Definição de Pronto (por módulo)

Um módulo só fecha quando TODOS os itens abaixo estão OK:

## Funcional
- [ ] Todos os campos/toggles da especificação existem e afetam o resultado (nenhum controle decorativo)
- [ ] Fluxo Analisar → revisar resultado → Aplicar → Desfazer funciona com mídia real do banco
- [ ] Nenhum arquivo de mídia original é modificado (verificar hash)
- [ ] Trilhas travadas são respeitadas
- [ ] Barra "Última ação / Desfazer" atualizada
- [ ] Jobs longos mostram progresso real e erros legíveis

## Qualidade
- [ ] Testes unitários das funções puras de análise (fixtures de áudio/vídeo sintéticas e pequenas em `tests/fixtures/editor_ia/`)
- [ ] Testes de API (analyze/apply/undo, permissões: usuário só mexe nas próprias timelines)
- [ ] `poetry run task format` e `poetry run task test` passando; cobertura do módulo ≥ 85%
- [ ] Lint/build do frontend passando
- [ ] Sem mocks, sem dados ilustrativos

## UX
- [ ] Funciona em tema claro e escuro
- [ ] Textos em PT (chaves i18n prontas para EN)
- [ ] Tooltips `?` em todo parâmetro técnico
- [ ] Painel estreito (modo compacto) sem quebra de layout

## Documentação
- [ ] Linha correspondente da `MATRIZ_DE_GAPS.md` marcada ✅
- [ ] Changelog curto no PR: o que entrou, o que ficou para depois

# Histórico — Editor IA no MCP do MMFilm (20 a 23/10/2026)

Serve para retomar o assunto numa conversa nova sem depender do histórico do chat.
Guia técnico do padrão em ícones: [MCP_FERRAMENTAS_EM_ICONES.md](MCP_FERRAMENTAS_EM_ICONES.md).
Especificação e matriz de gaps: [expansao-editor-ia/](expansao-editor-ia/) (os prints de referência ficam fora do Git: material de terceiros).

## O que o Alex pediu
- 20/10: levar para o MCP do MMFilm ferramentas de edição de um clique no estilo do plugin FX Master (Premiere), com ícones, detalhamento embaixo e fila. Só a ideia: nenhum código, nome ou pack (SFX, presets) de terceiros.
- 21/10: com o pacote `expansao-editor-ia` (prints do FX Master + 11 módulos), "expandir o MCP do Premiere e o que der para o After, sem retirar o que funciona". Regra dele: visual primeiro; o que ainda não funcionar aparece "em breve", sem botão falso.
- 23/10: pendências (transcrição, rampa de velocidade, multi-tela, biblioteca de sons) e publicação.

## Decisões
- **Análise no navegador**, não no servidor: a timeline do MMFilm e os arquivos do computador vivem no navegador; mandar ao servidor exigiria upload de cada vídeo. Web Audio + canvas fazem silêncio, cortes, ducking, sincronização e mudança de cena.
- **Transcrição pelo serviço que já existia** (`ensureTranscription` do ClipsFree): reaproveita a transcrição salva do asset no Acervo. A configuração de IA (de outro chat) não foi alterada. Arquivos do computador continuam com "Importar SRT".
- **Fundação no painel genérico** (`MCPToolPanel` + `MCPToolFields`), valendo para todos os apps: seções, campos −/+ com `?`, chips, cor, texto, forma de onda com regiões, lista com checkbox (aplica só o marcado), recálculo ao ajustar (`live`), confirmação, progresso real, barra "Última ação · Desfazer", rodapé (Transcrever / Importar SRT / Legendas, sequência, trilhas alvo), modo largo, ferramentas `status:"soon"`.
- **Efeitos no preview e na exportação** pela mesma composição (`programComposition` em `filmcraftRender.js`): movimento, motion presets, transições, looks, legendas com estilo, animação de texto e ducking.
- **After (MMEffects)**: o catálogo do MMEffects ficou com a sessão que replicou a grade (PR #8); animação de texto e motion presets entraram no MMFilm, onde a referência aplica.

## O que entrou (PRs na main, deploy automático no Render)
| PR | Conteúdo |
|---|---|
| `49f5677` (20/10) | Primeira grade de ícones do MMFilm (15 ferramentas) |
| #6 (21/10) | Fundação do painel + 52 ferramentas em 14 abas; bibliotecas de sincronização, multicâmera, legendas/vícios/títulos, animação de texto, motion presets, looks e transições |
| #10 (23/10) | Transcrever (Acervo), rampa de velocidade, multi-tela, biblioteca de sons; legenda curta junta com a seguinte; campo −/+ apagado não vira 0 |
| #19 (23/10) | Clonar estilo: referência é o primeiro clipe da seleção e só clipes visuais recebem |

Estado final: **55 ferramentas em 14 abas**, nenhuma "em breve". Matriz de gaps: 29 de 31 recursos ✅; parciais: idioma PT/EN do painel e jobs de backend com progresso (o progresso real existe na leitura do áudio e na detecção de cena, feitas no navegador).

## Testes (no fim de cada PR)
- Frontend completo verde: 1617 (PR #6), 1868 (PR #10) e 2000 testes (PR #19, junto com a main da época); lint, typecheck e build OK; verificação do GitHub (backend e frontend) verde.
- Bibliotecas e catálogos novos com 100% de cobertura; `filmcraftRender.js` e `filmcraftAudio.js` seguem abaixo de 100% por código antigo (o código novo está coberto).
- Conferido no navegador com mídia gerada para teste: silêncios, cortes, ducking (detecção automática), vícios, títulos, legendas com template, transição, look, motion preset, animação de texto, multi-tela, rampa, biblioteca de sons, clonar estilo.

## Como testar localmente
- Abrir o Docker Desktop antes (o PostgreSQL fica nele).
- Para uma worktree em porta própria, usar uma API com `CSRF_TRUSTED_ORIGINS` incluindo a porta (ver `mediamind-api-editoria` no `.claude/launch.json`); sem isso o login responde "Origem da requisição não autorizada".
- As mídias demo do Acervo não têm arquivo: para áudio, importar arquivos do computador.

## Pendências
- Pacotes próprios de sons livres (CC0) na biblioteca; prévia em vídeo de presets e transições; idioma PT/EN no painel.
- Transcrição só para mídias do Acervo; rampa de velocidade remove o movimento do clipe.
- `eslint.config.js` não analisa `src/mediamind/**`.

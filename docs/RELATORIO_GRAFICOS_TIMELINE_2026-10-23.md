# Ferramentas Gráficas: timeline do MMFilm, textos editáveis e barras — 22 e 23/10/2026

Registro completo do chat que tratou os "bugs gerais" dos clones Adobe (Ferramentas Gráficas).
Serve de histórico e ponto de retomada.

## 1. Pedido do Alex (22/10)

> A timeline no Premiere está ruim de mexer: ao importar vem só áudio ou só vídeo, não encaixa no início,
> ruim de arrastar para o lado, não acompanha, controles não funcionam. Todos os clones têm menus verticais
> com ícones e funções repetidos — revisar a barra de todos. O texto do After não é editável, nem os textos
> de alterações. Muitos bugs gerais.

Mapa de nomes: Premiere = **MMFilm** (`FilmCraftWorkspace.jsx`), After = **MMEffect** (`EffectCraftWorkspace.jsx`),
Photoshop = **MMPhoto**, Illustrator = **MMVector**, InDesign = **MMDesign**, Figma = **MMFig**, **MM3D**, **MMPDF**
(`RemainingCraftWorkspaces.jsx`), **MMLibs** (`CraftLibraryWorkspace.jsx`). Todos em
`frontend/src/mediamind/components/graphic-tools/`.

## 2. Linha do tempo do trabalho

| Quando | O que | Resultado |
|---|---|---|
| 22/10 | Worktree `../saas_001_mediamindai-timeline`, branch `fix/timeline-premiere-toolbars` (a partir de `feat/editor-ia-mmfilm`) | isolado das outras sessões |
| 22/10 | 3 diagnósticos em paralelo (timeline, textos, barras) — só leitura | causas com arquivo:linha (resumo na seção 3) |
| 22/10 | Correção da timeline do MMFilm (P1–P7 + barra) | 21 testes novos; 121 testes MMFilm verdes |
| 22/10 | `NumericField.jsx` compartilhado | 26 testes, 100% de cobertura no arquivo |
| 22/10 | Campos e Gráficos essenciais do MMFilm | 20 testes novos; 167 verdes |
| 23/10 | Alex commitou os ícones do MCP (PR #8); branch atualizada com a `main` | sem conflito |
| 23/10 | 3 correções em paralelo: MMEffect / MMVector / Photo+Design+3D+Fig+PDF+Libs | todas com TDD |
| 23/10 | Bateria completa do frontend: lint ok, typecheck ok, 1960 testes (1 asserção desatualizada corrigida) | verde |
| 23/10 | Commit `e9822c1`, PR [#11](https://github.com/alexmacielferreira1/saas_001_mediamindai/pull/11) — **mergeado pelo Alex** | — |
| 23/10 | CI `frontend` falhou no PR e na `main`: `FilmCraftWorkspace.mcpProvider.test.jsx` (vindo de outro PR, `ea60f10`) esperava "8,0 s" | causa: o teste dependia do bug P7 (duração do Monitor de Origem aplicada a qualquer mídia). Corrigido na branch `fix/ci-mmfilm-rodape` (esperado "12,0 s", a duração real da mídia) |

## 3. Diagnóstico (causas raiz)

### MMFilm (Premiere)
- **P1 só vídeo ou só áudio:** `insert`, `insertAtPlayhead` e `dropOnTrack` criavam um único clipe; o Patch de origem só mudava cor.
- **P2 régua desalinhada:** largura do canvas ignorava os 144 px do cabeçalho e os ticks encolhiam no flex — erro de até 7,5 s com zoom alto.
- **P3 clique na régua:** `onClick` do tick (`setPlayhead(index*5)`) sobrescrevia o pointerdown — ia para o múltiplo de 5 s anterior.
- **P4 arrastar:** soltura sem o ponto de pega; ímã arredondava para segundo inteiro e não encaixava em bordas.
- **P5 não acompanha:** `scrollLeft` só na ferramenta Mão; zoom não mantinha o playhead; reprodução não parava no fim.
- **P6 controles:** `Fit`/`1/2` sem ação, `◀│▶` era texto, Play do Programa sumia sem vídeo no topo, timecode falso, Sync/Gravar sem efeito, ícones decorativos.
- **P7 duração:** `makeClip` usava IN/OUT do Monitor de Origem para qualquer mídia.

### Textos e campos (todos os apps)
- Nenhum atalho global engolia teclas; os problemas eram:
  - **MMEffect:** texto do canvas era `<span>` sem edição; ferramenta T criava camada vazia com foco no BODY → letras viravam atalhos e **Backspace apagava a camada**; tagline fixa no JSX.
  - **Campos numéricos:** `Number(e.target.value)` → apagar virava 0, sem "-" nem decimal; **MMVector gravava NaN e a forma sumia**.
  - **Campos decorativos:** Gráficos essenciais (MMFilm), painéis Transformar/Texto/Parágrafo/Gradiente (MMVector) com `defaultValue` sem efeito.
  - **`window.prompt`** (bloqueado em painel embutido) em MMEffect, MMPhoto, MMPDF, MMLibs.
  - Foco do editor de texto perdido no mousedown (MMPhoto, MMFig).

### Barras de ferramentas
- Não existe componente compartilhado; cada app monta a sua.
- Pior caso: MMVector (dezenas de ferramentas com o mesmo ícone, 9 sem suporte parecendo ativas, 3 botões mortos).
- MMFilm: Snapping duplicado, Slip/Slide com ícone de Duplicar. MMEffect: Rotação/Âncora/Zoom só por atalho.

## 4. O que foi entregue (PR #11)

- **MMFilm:** par vídeo+áudio com `linkId` (move, corta, apara, exclui, copia junto; `audioClipsForMix` não duplica som); constantes `TRACK_HEADER_W`/`RULER_H`/`TRACK_H`; régua `role="slider"` no quadro exato; ímã em 0/playhead/marcadores/bordas; rolagem por página e zoom ancorado; parada no fim; Programa com Play/progresso da sequência, ±1 quadro, timecode HH:MM:SS:QQ; Gráficos essenciais (fonte, tamanho, alinhamento, cor) gravando em `clip.captionStyle`; pesquisa de efeitos e categoria de modelos filtram; Sync/Gravar/mesclagem/LUT/saída e automação do mixer desabilitados com "Ainda não disponível"; ícones únicos na barra.
- **`NumericField.jsx`:** rascunho em string, vírgula decimal, Enter/blur com clamp, Esc restaura, setas ±step (Shift ×10), nunca emite NaN. Usado em MMFilm, MMEffect, MMVector, MMPhoto, MM3D e MMFig (`NumField`).
- **MMEffect:** edição no canvas (duplo clique / T; Ctrl+Enter confirma, Esc cancela), T sem apagar camada, "Texto de origem" nas Propriedades, tagline da própria camada (também no WebM), pesquisa da timeline e "Repetir" reais, diálogo próprio para composição, barra com Zoom/Rotação/Âncora e Câmera/Luz em flyout.
- **MMVector:** campos sem NaN (+ defesa em `patchObject`), painéis Transformar/Gradiente linear/Texto/Parágrafo/Cor/Transparência/Informações reais, 68 ferramentas com ícones distintos (teste garante), Seleção direta move pontos, ferramentas sem suporte esmaecidas, «Recolher» e "Mais ferramentas" funcionando, "Modos de desenho" removido.
- **MMPhoto:** barra em slots com flyout (padrão Photoshop), campos numéricos, diálogo próprio (Tamanho, Rotação, Exportar), foco do texto corrigido.
- **MMDesign:** ícones de Seleção direta e Linha próprios, aria na barra.
- **MM3D:** campos numéricos, "Adicionar objeto" em flyout, Outliner e Atalhos funcionando (G/R/S, Shift+D, Delete), "Arquivo" removido.
- **MMFig:** `NumField` sobre `NumericField`, foco do editor de texto e de comentário, ícone próprio em "Baixar projeto".
- **MMPDF / MMLibs:** todas as ferramentas de texto com diálogo próprio; ícones de Exportar/Comentar próprios.
- **Abas (`GraphicTools.jsx`):** Word com `FileType2`.

Testes novos: `FilmCraftWorkspace.timeline/fields`, `EffectCraftWorkspace.text`, `VectorCraftWorkspace.fields`,
`NumericField`, `CraftLibraryWorkspace` e casos novos nos testes dos demais apps.

## 5. Verificações (resultados reais)

- 23/10, branch `fix/timeline-premiere-toolbars`: `npm run lint` e `npm run typecheck` sem erros; `npx vitest run` 1959/1960
  e, após corrigir a asserção desatualizada, `GraphicTools.test.jsx` 28/28.
- Cobertura medida: apenas `NumericField.jsx` (100% linhas/branches). Não houve medição global.
- Navegador: **não conferido** (limite de 5 servidores por pasta ocupado por outros chats; depois login exigido; Alex pediu para pular).
- CI do PR #11: `frontend` falhou pelo teste do rodapé do MCP (seção 2). Corrigido na branch `fix/ci-mmfilm-rodape` — ver seção 7.

## 6. Pendências (para os próximos chats)

1. **Conferência visual** no navegador de todos os apps gráficos (régua/rolagem do MMFilm, editores de texto do MMEffect/MMPhoto/MMFig, flyouts, console).
2. **MMFilm:** cards de modelo em Gráficos essenciais gravam `graphicTemplate` mas nada lê (definir como cada modelo vira `captionStyle`); interruptores do Lumetri só mudam a aparência; abas Procurar/Editar do Som essencial; 3 listas sem estado no `ExportWorkspace`; Patch de origem das faixas V ainda sem efeito; linhas de Informações com valores fixos.
3. **MMVector:** menus ☰/» dos painéis, Amostras, Guia de cores, Pincéis/Símbolos/Estilos, Pranchetas, Histórico, Ações, Navegador; opções do Traçado (extremidade, canto, tracejado, pontas); "fx"/"•••"; Documento (Configurar, Réguas, Guias); sufixo "pt" no Peso do Traçado (valor é px).
4. **MMEffect:** "Alinhar camadas a" desabilitado (só há seleção única).
5. **Componente `ToolRail` compartilhado** (sugestão da auditoria) não foi criado; as barras foram corrigidas app a app.
6. **Tema claro:** quando a branch `claude/tema-claro-escuro` entrar, adaptar o diálogo `FilmCraftTextPrompt.jsx` (hoje cores escuras fixas) e conferir os flyouts novos.
7. Avisos de lint pré-existentes (`eslint-disable` sem uso) em Effect ~1084, Vector ~2272, Design ~229, Photo ~1556.

## 7. Correção do CI pós-merge (23/10)

- Branch `fix/ci-mmfilm-rodape` (a partir de `origin/main` `a9b7927`).
- `FilmCraftWorkspace.mcpProvider.test.jsx:47`: esperado `8,0 s` → `12,0 s` (a mídia do teste tem 12 s; o bug P7 aplicava o IN/OUT padrão de 8 s).
- MMFilm: 16 arquivos, 253 testes verdes. Bateria completa do frontend: `npm run lint` ok, `npm run typecheck` ok,
  `npx vitest run` 233 arquivos / 2033 testes, todos passando.

## 8. Ambiente e armadilhas aprendidas

- **Worktrees deste trabalho:** `../saas_001_mediamindai-timeline` (branches `fix/timeline-premiere-toolbars` — mergeada — e `fix/ci-mmfilm-rodape`).
  Pode ser removida depois que o PR da correção for mergeado.
- **`.claude/launch.json`** (checkout principal, fora do Git): entradas `mediamind-api-timeline` (8007) e `mediamind-web-timeline` (5186).
- **Limite do app:** 5 servidores de preview por pasta; outros chats ocupavam 4.
- **Login:** a senha de demo fica no `.env` (não lida pelos agentes); conferência visual depende do Alex entrar.
- **Trava `guarda.cjs`:** bloqueia `merge` e qualquer comando com "push" quando o diretório atual está na `main`; rodar git de dentro da worktree (EnterWorktree).
- **PowerShell 5.1:** `Get-Content -Raw` lê UTF-8 sem BOM como ANSI e `Set-Content -Encoding utf8` grava BOM — estragou acentos de um teste (corrigido). Usar o Edit ou `[IO.File]` com `UTF8Encoding($false)`.
- **Commit com aspas no PowerShell:** usar `git commit -F arquivo`.
- **Stash é compartilhado** entre worktrees: usar mensagem única e `stash apply <sha>`.
- **Worktree `../saas_001_mediamindai-mcpicones`:** tem alterações não commitadas de 20/10 (Design/Effect/Photo/Vector/GraphicTools/personSegmentation) que parecem substituídas pelo PR #8 — Alex decide antes de descartar.

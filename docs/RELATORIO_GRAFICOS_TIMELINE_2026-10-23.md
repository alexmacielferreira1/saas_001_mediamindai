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

Observação: outro chat já tinha aplicado a mesma correção na `main`; no merge ficou a versão da `main` e o PR
[#18](https://github.com/alexmacielferreira1/saas_001_mediamindai/pull/18) ficou só com esta documentação.

## 9. Segunda rodada no MMFilm: áudio, sobrescrever e arraste fluido (23/10)

Relato do Alex após testar em produção: o áudio do vídeo não toca (sem nenhum aviso); soltar um vídeo em cima
de outro deixa os dois sobrepostos (no Premiere o novo corta o de baixo); arrastar na timeline é travado e impreciso.
Branch `fix/mmfilm-timeline-fluida` (a partir da `main` `dd2a232`).

**Causas**
- Áudio: o motor esperava `await context.resume()` sem limite; no tablet/Safari o contexto criado fora do clique
  fica suspenso e nada era agendado, sem aviso. O som também dependia 100% de baixar e decodificar o arquivo
  inteiro (`loadAudioBuffer`), e falhas ficavam em cache para sempre. O `<video>` do Programa é sempre mudo.
- Sobrescrever: soltar mídia fazia `[...old, ...items]` e mover só trocava `start`/`track`; `placeClip(..., "overwrite")`
  já existia em `mmfilmEdits.js` mas não era usado nesses caminhos. `compatible()` deixava o A1 subir para V2.
- Arraste: drag HTML5 nativo (sem prévia, ímã só no drop, ruim no toque); trim/ripple/rate só no `pointerup`;
  playhead com `setPlayhead` a cada movimento re-renderizando ~5 mil linhas; reprodução a 10 fps (`setInterval` 100 ms).

**Correções**
- `filmcraftAudio.js`: `unlock()` no próprio clique do Play; `play()` espera o resume no máximo 300 ms; plano B por
  elemento de mídia (`scheduleElement`, ligado ao barramento da faixa via `createMediaElementSource`) quando o buffer
  não fica pronto em 400 ms, falha ou o arquivo passa de 150 MB; som direto por `<audio>` se o contexto continuar
  suspenso; falhas saem do cache (nova tentativa após 30 s); erro visível se nada tocar em 8 s.
- `FilmCraftWorkspace.jsx`: URLs passam por `resolveMediaUrl`; ícone persistente de problema de áudio no clipe
  (`data-audio-issue`) no lugar do toast de 5 s; exportação avisa quando sai sem áudio (`onWarning`).
- `mmfilmEdits.js`: `overwriteItems`, `moveClips` (Ctrl = inserir, Alt = duplicar) e `trackOverlaps` (invariante).
  Sobrescrever vale para soltar mídia, mover, duplicar, nudge, rate stretch e criar título, em V e no A vinculado.
  V só vai para V e A só para A.
- `filmcraftTimelineDrag.js` (novo): arraste por pointer events com captura, limiar de 3 px, prévia por rAF,
  fantasma com `transform`, troca de faixa, linha do ímã ao vivo, Esc/pointercancel cancelam, grava no soltar.
  Alças de aparo de 7 px na Seleção; Ripple/Rate/Slip/Slide com prévia; mídia do Projeto com fantasma no dragOver;
  scrub e reprodução por rAF; faixas em `TimelineLaneClips` com `memo`.

**Verificação**
- MMFilm + lib: 19 arquivos, 304 testes verdes; 39 testes novos (a maioria vista falhando antes; 3 de áudio e 1 de
  exportação foram escritos junto com o código). Bateria completa: ver PR desta branch.
- Harness local no Chrome com vídeos de tom 440/660 Hz: sobrescrever no meio (A[0-2], B[2-5], A[5-6] em V1 e A1),
  agendamento correto, plano B com decodificação desligada e com resume pendurado, arraste com fantasma.
- Não validado: ouvir o som de fato, fluidez visual (painel oculto), Safari/iPad real, arquivo > 150 MB vindo da API,
  CORS com credenciais em produção.

**Riscos/pendências desta rodada**
- Safari pode barrar o `play()` do elemento de plano B por autoplay; nesse caso aparece erro no clipe (testar no iPad).
- Aba oculta: a reprodução não para sozinha no fim (rAF parado); o som para.
- Som direto (contexto suspenso) sem pan nem curva de volume. → volume resolvido na seção 10; pan continua sem suporte.

## 10. Terceira rodada: ajustes gerais das pendências (24/10)

Pedido do Alex: fazer todas as pendências das seções 6 e 9. Mesma branch `fix/mmfilm-timeline-fluida`.

**MMFilm**
- Aba oculta: timer de 250 ms assume o avanço quando o rAF para; a reprodução para no fim.
- Som direto: volume segue curva do clipe, mudo/solo/fader/master ao vivo; pan não é possível sem AudioContext (aviso diz isso).
- Plano B: `src` só 3 s antes do trecho, elemento solto no fim (`releaseElement`); `AbortError` e trechos já parados não geram aviso falso; erro antigo some quando o som toca.
- Gráficos essenciais: 8 modelos aplicam `captionStyle` real no título selecionado (substituem o estilo inteiro).
- Lumetri: Correção básica e Criativo ligam/desligam na prévia e exportação; Curvas/Rodas/HSL/Vinheta desabilitados.
- Som essencial: abas Editar/Procurar funcionam. Exportar: Ordem dos campos/Aspecto/Perfil desabilitados mostrando o que sai de fato.
- Patch V, Direcionar e "Faixa de destino" agora são um estado só (um V com patch, como no Premiere).
- Informações com dados reais (clipe → mídia da Origem → sequência).
- Título sem faixa livre sobrescreve e avisa (Ctrl+Z desfaz).
- `FilmCraftTextPrompt.jsx` com tokens `mm-dialog*` (`theme/palette.cjs`), idêntico no escuro e legível no claro.

**MMVector**: Traçado real (extremidade, canto, limite, tracejado em posições fixas com caixa `dashed`), sufixo px, Amostras, Guia de cores, Estilos gráficos, Histórico, Ações, Navegador, Aparência, Réguas/Grade/Limites/Guias. Desabilitados com motivo: menu ☰, pontas de seta/perfil, Pincéis/Símbolos, pranchetas múltiplas, gravação de ações, encaixe nas guias.

**MMEffect**: botões de alinhar levam as bordas reais da camada às bordas/centro da composição. Alinhar camadas entre si continua desabilitado (só há uma transformação por composição).

**`ToolRail.jsx`** (novo, 100% de cobertura no arquivo) com slots/flyout, Esc e clique fora; usado no MMPhoto. Os demais apps seguem com barra própria (migrar muda visual — decisão do Alex).

**Lint**: removidos os `eslint-disable` sem uso em Effect, Vector, Design, Photo e Film.

**Revisão de código**: aprovada com ressalvas; corrigidos Patch V × Direcionar, aviso falso do plano B, download antecipado, aviso do título e tracejado compactando campos.

**Verificação**: MMFilm + lib 82 arquivos / 676 testes; Vector 77; Effect/Design/Photo 237; ToolRail 8; lint e typecheck ok. Bateria completa: ver PR. Navegador e iPad/Safari: não conferidos nesta rodada (E2E com login em preparo na branch `test/e2e-fluxo-completo`).

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

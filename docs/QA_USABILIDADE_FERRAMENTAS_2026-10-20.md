# QA de usabilidade - Ferramentas Gráficas, ClipsFree, Timeline 2 e Workspace (2026-10-20)

Segunda passada de QA (somente relato; nenhum arquivo de código foi alterado). Ambiente: frontend já rodando em `http://localhost:5175`, conta demo logada ("Alex Maciel Ferreira"), API de outro chat. Viewports usados: 1280x720 e 1440x900 (emulados no painel do navegador).

Baseline: `npx vitest run src/mediamind/components/graphic-tools src/mediamind/pages/CraftSuites.test.jsx src/mediamind/pages/GraphicTools.test.jsx` = 18 arquivos, 221 testes, todos passando (inclui os testes novos de ferramentas do MMFilm, Vector, Photo, Fig).

Severidade: ALTA = layout quebrado ou controle principal inutilizável; MÉDIA = fluxo confuso/feedback invisível; BAIXA = polimento.

## Limitações do ambiente (leia antes)
- O painel do navegador estava "oculto": capturas de tela às vezes ficam defasadas em um passo (mostram o estado anterior) ou ficam em branco após rolagem. Confirmei os resultados esperando 1-2 s e repetindo a captura, mas pode haver erro de leitura em casos isolados.
- A aba `seed` é compartilhada: o coordenador navegou para `/` uma vez durante o teste (avisado por mensagem); refiz o passo afetado. Não considero esse efeito como bug.
- Não é possível escolher arquivo local nem usar `window.prompt` nesse painel: sem mídia, boa parte do MMFilm, ClipsFree e Timeline 2 ficou sem teste real (ver "Não coberto").
- Ao clicar em "Salvar" do MMDesign, o app baixou `publicacao.mmdesign.json` (arquivo gerado pelo próprio app, local). Evitei os demais botões de exportar/baixar.

## Resumo de achados
| Gravidade | Qtde |
|---|---|
| ALTA | 3 |
| MÉDIA | 9 |
| BAIXA | 12 |

Lista dos 3 ALTA: (1) cabeçalho do MMFilm sobrepõe a barra Importar/Editar/Exportar em telas >= 1280 px; (2) menus superiores do MMEffects abrem recortados (invisíveis); (3) botões "Construir" e "Gravar" do MM3D continuam sem ação.

## 1. /ferramentas-graficas - visão geral da página
| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Página com viewport 1280 px (sidebar aberta) | Navegar entre MMLight, MMPDF, MMDesign, MMLibs, MMFilm | O `<main>` ganha rolagem horizontal; ao focar um botão, a página desloca para a direita e o título "Ferramentas Gráficas" fica cortado à esquerda; painéis da direita (Camadas/Propriedades do MMPhoto, Inspetor, "Motores" do MMLibs) ficam cortados na borda | Largura mínima dos workspaces maior que a área útil com a sidebar aberta; o dono teme exatamente isso | MÉDIA | Definir largura mínima explícita do workspace dentro de um contêiner `overflow-x-auto` próprio (não no `main`), ou recolher a sidebar automaticamente ao abrir a página; mostrar aviso "melhor visualizado em tela >= 1440" |
| Abas de programa | Clicar MMVector, MMFig, Excel, PowerPoint... | URL muda (`?tool=vectorcraft`, `?tool=excel`) | Ao trocar de Excel para PowerPoint dentro de "Office" a URL continua `?tool=excel`; `?tool=` desconhecido (ex. `threedcraft`) cai silenciosamente no MMFilm | BAIXA | Sincronizar a URL com a subaba; id de 3D é `threecraft` (GraphicTools.jsx:142) |
| Barra "Rascunho salvo neste navegador / Baixar recuperação / Restaurar cópia anterior / Abrir recuperação" | Observar | Funciona como indicador de autosave | Quatro links pequenos sem explicação do que é "recuperação" | BAIXA | Tooltip/legenda curta |

## 2. MMFilm (FilmCraftWorkspace.jsx)
| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Cabeçalho do projeto (Salvar como, Recarregar, Importar projeto, formato, Exportar projeto, Importar mídia, Religar mídia) vs. abas Importar/Editar/Exportar | Abrir em viewport >= 1280 px (sidebar aberta) | BOTÕES SOBREPÕEM AS ABAS: "Salvar como/Recarregar" ficam por cima de "Importar/Editar" e o primeiro botão fica cortado à esquerda ("carregar"). Reproduzido em 1280 e 1440 | `index.css:23-48`: a partir de 1280 px o cabeçalho vira `display:flex; flex-wrap:nowrap` e `.mmfilm-project-actions` usa `justify-content:flex-end` com `min-width:0`; quando o conteúdo não cabe, transborda para a esquerda sobre a navegação | ALTA | Em `index.css` manter `flex-wrap:wrap` no bloco `@media (min-width:1280px)` (ou subir o breakpoint para ~1600 px / usar container query), trocar `justify-content:flex-end` por `flex-start` com `overflow-x:auto` |
| Abas Importar / Editar / Exportar | Clicar | Troca de workspace, mas o sublinhado fica sempre em "Editar" | Aba ativa hard-coded (FilmCraftWorkspace.jsx:1596-1601): quando o workspace é Exportar, "Editar" continua marcada | MÉDIA | Marcar a aba conforme `workspace` |
| Estado inicial ao recarregar | Abrir a página | Abre em "Exportar" quando esse foi o último estado (rascunho persistido) | Combinado com o sublinhado fixo em "Editar", o usuário vê painel de exportação sob aba "Editar" | BAIXA | Ver linha anterior |
| Menu "Gráficos e Títulos" | Clicar | Dropdown abre e funciona; "Nova camada", "Instalar modelo" etc. agora mostram aviso honesto ("ainda não suportadas") | Menu permanece aberto após recarregar a página (estado persistido em rascunho, FilmCraftWorkspace.jsx:~1731 `applicationMenu`) | BAIXA | Não persistir `applicationMenu` |
| Menu > "Novo texto" e ferramenta Texto (T) | Clicar na faixa V1 com Texto | Só move o playhead; título não aparece | `createTitle` usa `window.prompt` (FilmCraftWorkspace.jsx:913); em painéis embutidos/Electron o prompt é bloqueado e a ação falha em silêncio | MÉDIA | Trocar `prompt` por popover/diálogo próprio com campo de texto; avisar quando o prompt retornar `null` por bloqueio |
| Navalha, Ripple, Rate stretch, Slip, Caneta, Mão, Selecionar faixa | Verificação estática (sem clipes) | Agora há implementação real (`clickClipWithTool`, `beginClipTool`, FilmCraftWorkspace.jsx:1083-1160); a lista "morta" da auditoria foi atendida | Não consegui testar com arrasto real por falta de mídia; cobertura apenas por `FilmCraftWorkspace.tools.test.jsx` (passou) | - | Reexecutar com mídia (ver "Não coberto") |
| Painel de exportação | Ler | Formato "H.264" selecionado, mas o resumo diz "Saída: ... Sequência 01.webm - WebM (VP9/VP8) ... Opus 320 kbps" | Rótulos enganosos: H.264/AAC/MP4 exibidos nos selects, saída real é WebM; campo "Local" agora honesto ("pasta de downloads do navegador") | MÉDIA | Limitar a lista de formatos aos que o MediaRecorder realmente gera, ou renomear "H.264" para "WebM (VP9)" |
| Exportação "Tamanho estimado: 0 MB" com timeline vazia | Ler | Botão "Exportar" aparece habilitado | Sem aviso de "nada para exportar" antes do clique | BAIXA | Desabilitar com título explicativo |
| Layout 1280 px: painel "Propriedades" à direita | Rolar | Cortado na borda (Precisão dos ajustes etc.) | Mesmo problema de largura da seção 1 | MÉDIA | Ver seção 1 |

## 3. MMEffects (EffectCraftWorkspace.jsx)
| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Menus Arquivo / Editar / Composição / Camada / Efeito / Animação / Exibir / Janela / Ajuda | Clicar "Editar" | O botão fica destacado, o dropdown existe no DOM (botão "Desfazer" localizável) mas NÃO aparece na tela | EffectCraftWorkspace.jsx:1307: a barra tem `overflow-x-auto`; isso força `overflow-y:auto` e recorta o menu `absolute top-full` (linha 1311). O mesmo risco em 1318 | ALTA | Remover `overflow-x-auto` da barra de menus (ou renderizar o dropdown em portal / `position:fixed`) |
| Seletor de área de trabalho | Observar | Combo `sr-only` + botões Padrão/Animação/Standard/Tela pequena na mesma tela | Funcionalmente ok; duplicidade só para leitor de tela | BAIXA | Nenhuma |
| Altura do componente | Ver | `h-screen min-h-[720px]` (linha 1302) dentro de uma página com cabeçalho: o editor é mais alto que a área visível | Rola a página inteira para ver a timeline | BAIXA | Usar altura calculada (`calc(100vh - cabeçalho)`) |
| Controles de efeitos (Color Range etc.) | Observar | Sliders respondem e há "Redefinir" por efeito | Não testei render do efeito | - | - |

## 4. MMVector (VectorCraftWorkspace.jsx)
| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Lápis (N) | `left_click_drag` na prancheta | Cria "Traçado" selecionado com caixa de transformação | Arrasto reto do teste gera linha reta (esperado); não verifiquei suavização | - | - |
| Pincel (B) | Arrasto | Cria traço mais grosso | OK; o traço pode cruzar a borda da prancheta sem recorte visível | BAIXA | Recortar à prancheta ou avisar |
| Borracha (Shift+E) | Arrasto sobre a curva azul | Abre lacuna na curva (apaga trecho) | OK | - | - |
| Painel flutuante "Aparência" | Abrir a ferramenta | Abre por padrão cobrindo parte da prancheta e dos objetos ao carregar (`appearanceOpen` padrão `true`, VectorCraftWorkspace.jsx:986) | Primeira impressão: painel sobre o desenho; fechar exige menu Janela > "Aparência flutuante" | MÉDIA | Padrão `false`, ou botão "x" visível no painel (já existe "x" mas pequeno) |
| Barra lateral de ferramentas | Observar | A coluna é maior que a viewport e rola internamente (ferramentas "Formas/Desenho/Modificar" cortadas) | Sem indicador de rolagem | BAIXA | Mostrar sombra/seta de rolagem |
| Menu Arquivo | Clicar | Dropdown visível: Novo documento, Abrir, Colocar, Salvar, Exportar SVG, Exportar PNG | "Salvar" e "Exportar" agora existem no menu (itens da auditoria atendidos); não os acionei (download) | - | - |
| Persistência | Recarregar | Traços criados persistem como rascunho | OK | - | - |

## 5. MMPhoto (PhotoCraftWorkspace.jsx)
| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Pincel (B) | Arrasto no canvas | Pinta traço real; histórico mostra "Rasterizar camada" + "Pincel" | Traço recortado pelo limite da camada ativa (linha azul horizontal visível ~y da camada) sem aviso | BAIXA | Mensagem "pintura limitada à camada" |
| Borracha (E) | Arrasto | Apaga parte do traço; histórico acrescenta "Borracha" com 1 passo de atraso | OK | - | - |
| Letreiro (M) | Arrasto | Mostra seleção tracejada retangular | Seleção não entra no histórico | BAIXA | Registrar "Letreiro" no histórico |
| Menu Filtro > Desfoque | Clicar | Aplica e registra "Desfoque" no histórico; mensagem "Desfoque aplicado em ..." espremida na barra de opções e truncada | Mensagem truncada | BAIXA | Mover para linha própria |
| Modo de mesclagem (combo) | Ler opções | Opção "Divisão" com valor `screen` | Rótulo errado: `screen` é "Tela"; "Divisão" é outro modo (PhotoCraftWorkspace.jsx:641) | MÉDIA | Renomear para "Tela" |
| Exportar como / Salvar PSD | Não acionei (download) | - | - | - | Ver "Não coberto" |

## 6. MMLight, MMPDF, MMDesign, MM3D, MMLibs
| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| MMLight: módulos Biblioteca/Revelação/Mapa/Livro/Apresentação/Imprimir | Clicar "Mapa" | Troca de módulo e mostra aviso honesto "o MMLight ainda não lê coordenadas GPS" | A página rolou horizontalmente e o cabeçalho ficou cortado (largura) | MÉDIA | Ver seção 1 |
| MMLight: 5 botões de ícone na lateral da biblioteca | Ler árvore de acessibilidade | Botões sem nome acessível (`button` vazio) | Sem `aria-label`/título | BAIXA | Adicionar `aria-label` |
| MMLight: estado vazio | Ver | "0" em todas as categorias, sem fotos | Para testar é preciso importar fotos (não possível no painel) | - | - |
| MMPDF: Zoom +, Girar à direita | Clicar | Zoom 125% e página girada; mensagem "Rotação aplicada à visualização (não é gravada no arquivo)" | Honesto; texto da página girada fica cortado | BAIXA | - |
| MMPDF: OCR / Adicionar texto / Marca d'água sem PDF aberto | Clicar OCR | Apenas pequena mensagem cinza ("Abra um PDF primeiro") quase invisível abaixo da lista | Feedback pouco visível | MÉDIA | Desabilitar os botões sem PDF e mostrar aviso em destaque |
| MMDesign: Salvar | Clicar | Baixa `publicacao.mmdesign.json` e define status "Publicação salva (rascunho local + arquivo .mmdesign.json)" | Status textual não ficou visível na tela após o clique (apenas download) | BAIXA | Mostrar toast |
| MMDesign: Publicar PDF, Adicionar página | Verificação estática | `save`/`publish` implementados (DesignCraftWorkspace.jsx:467,495) | Não acionei Publicar PDF (download) | - | - |
| MM3D: botões Construir e Gravar | Clicar | Nada acontece | Continuam sem `onClick` (ThreeDCraftWorkspace.jsx:116) - item da auditoria ainda aberto | ALTA | Implementar ou remover/desabilitar com tooltip "em breve" |
| MM3D: Adicionar esfera/cubo, lista Cena | Clicar | Esfera entra na lista, no viewport e no painel Transformar | Viewport é 2D (ícone de cubo dentro de círculo); esfera exibe ícone de cubo | BAIXA | Ícone coerente por tipo; rotular como "prévia 2D" |
| MMLibs: Pastas / Sem pasta | Clicar "Sem pasta" | Botão destaca; conteúdo permanece "Biblioteca compartilhada - adicione ativos" (0 itens) | Sem diferença perceptível entre "Todos" e "Sem pasta" quando vazio; painel "Motores" à direita cortado em 1280 | BAIXA | Estado vazio específico por filtro |

## 7. MMFig (FigCraftWorkspace.jsx)
| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Frames predefinidos (iPhone 14) | Clicar "Criar frame iPhone 14" | Frame 390x844 criado, selecionado, zoom 76% e painel Design com alinhamento, X/Y/L/A, Recortar conteúdo, Auto layout | OK; estado vazio ("Página vazia. Use Frame (F)...") é claro | - | - |
| Retângulo (R) | Arrasto dentro do frame | "Retângulo 1" criado aninhado ao frame, com medidas "211 x 147.7" | OK | - | - |
| Menu Objeto > "Adicionar/remover auto layout" | Clicar | Envolve o retângulo em "Frame 2" com auto layout; aviso "Auto layout aplicado." no cabeçalho | Aviso aparece no cabeçalho, longe da seleção | BAIXA | Toast perto do canvas |
| Apresentar | Clicar | Abre overlay "Apresentação" com seletor de frame, Voltar (desabilitado), Reiniciar, "Áreas clicáveis", fecha com Esc | Sem frames conectados não há dica de como criar a primeira interação | BAIXA | Texto "Conecte frames na aba Protótipo" |
| Cabeçalho | Ler | "Abrir projeto", "Baixar projeto" e "Exportar" lado a lado; no menu há também "Baixar projeto"/"Exportar" | Rótulos próximos ("Baixar projeto" vs "Exportar") sem diferença clara | BAIXA | Explicar em tooltip |

## 8. MMSom, Word, Excel, PowerPoint
| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| MMSom: abas "MMSOM completo" / "Mesa integrada" | Abrir ambas | Duas interfaces diferentes de áudio dentro de iframes (não inspecionáveis por acessibilidade) | Duas mesas concorrentes confundem o objetivo | MÉDIA | Decisão do Alex (ver seção 12) |
| Mesa integrada: Gravar | Clicar no botão vermelho | Pede microfone (bloqueado no painel; funcionalidade agora real) | Sem mensagem visível se o microfone for negado (não confirmado) | BAIXA | Exibir erro de permissão |
| Mesa integrada: M (mute) | Clicar | Alterna estado laranja | OK | - | - |
| Mesa integrada: menu Arquivo | Clicar | Importar áudio, Salvar sessão (JSON + mixdown WAV), Exportar mixdown (WAV) | Itens da auditoria atendidos; não acionei (download/arquivo) | - | - |
| Excel: células A1:A3 = 10/20/30 e A4 `=SOMA(A1:A3)` | Digitar e Enter | A4 mostra 60 e Enter desce para A5; "Fórmulas > Mostrar fórmulas" exibe `=SOMA(A1:A3)` | OK; grade apenas 6 colunas visíveis (A-F) | BAIXA | - |
| Excel: abas Dados / Revisão | Clicar | Texto "Os comandos desta guia ainda não estão disponíveis no navegador" | Abas vazias clicáveis | BAIXA | Desabilitar abas sem função |
| PowerPoint: Apresentação > Apresentar do início | Clicar | Tela cheia com slide, Esc fecha | Legenda "Slide 1 de 1 - setas navegam - Esc encerra" fica no limite inferior da tela (quase cortada) | BAIXA | Reduzir altura do slide (`max-w` calculado) |
| Word | Verificação rápida | Toolbar com Desfazer/Refazer/Salvar visível | Não testei B/I/U nem digitação (captura falhou) | - | Ver "Não coberto" |

## 9. /clipsfree
| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Tela inicial (1280 px) | Ver | Layout sem sobreposição: Mídias finalizadas, Vídeo de origem, Configurar sessão | OK | - | - |
| Preset "Curtos 15-30s" | Clicar | Mínimo muda para 15 | OK | - | - |
| Formato 9:16 / 1:1 / 16:9 | Clicar 1:1 | Aceito (sem erros); não confirmei destaque visual por captura defasada | - | - | - |
| "Gerar sugestões" | Ver | Desabilitado, texto "Nenhuma IA com créditos configurada - a administração define a conexão" | Claro | - | - |
| Cortes de exemplo 1-3: Revisar / Editor | Clicar Editor | Botões desabilitados (cinza) sem vídeo; cartões dizem "Selecione um vídeo para visualizar" | Não há tooltip explicando por que o botão está desabilitado | BAIXA | `title="Selecione um vídeo primeiro"` |
| Editor, painel de legendas, atalhos, zoom, duração, desfazer | - | NÃO TESTADO (exige vídeo local) | - | - | Ver "Não coberto" |

## 10. /timeline2
| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Layout 1280 px | Abrir | Inspetor e título ficam cortados à direita ("Nenhum / selec...") | Largura mínima maior que a área útil | MÉDIA | Colapsar Inspetor em < 1400 px |
| Layout 1440 px | Abrir | Sem sobreposições; barra de ferramentas e trilhas T1/V2/V1/A1/A2 ok | - | - | - |
| Preview vazio | Ver | Em 1280 (primeira carga) o preview mostrava um emoji de fogo; em 1440 mostra "Timeline vazia - importe um arquivo" | Emoji 🔥 aparece também ao lado de "T1" e junto ao cronômetro (fonte `lib/captionTools.js`/`timeline2Presets.js`) | BAIXA | Remover emoji de rótulos estruturais |
| Biblioteca > Texto > "Adicionar no playhead" | Digitar "Teste QA" e clicar | Clipe "Teste QA" 00:00:05:00 criado em T1; mensagem "Texto adicionado no playhead." | A mensagem fica numa linha minúscula abaixo da barra de ferramentas e permanece desatualizada depois de outras ações | MÉDIA | Toast temporário visível |
| Arrastar clipe (T1) | `left_click_drag` | Clipe move e fica selecionado; Inspetor mostra posição/fim | OK | - | - |
| Dividir (clique na régua + botão) | Clicar | Clipe dividido em duas partes; "Edição aplicada. Desfazer restaura o gesto inteiro." | Mensagem clara; ao clicar na régua com um clipe selecionado o playhead moveu (ok) | - | - |
| "O que entra no MP4" | Clicar | Painel explica: ENTRA (trilha V1, cortes IN/OUT, áudio original, 1280x720 H.264/AAC), FICA FORA (textos e legendas T1: 2 clipes), SÓ NO PREVIEW | Texto claro e honesto; ótimo | - | - |
| Atalhos (ícone de teclado) | Clicar | Popover "Atalhos de teclado" com Reprodução/Navegação/Edição | Popover sobrepõe o painel "O que entra no MP4" e o Inspetor; lista cortada no fim (rolagem interna) | BAIXA | Fechar um painel ao abrir o outro |
| Exportar clipe / Exportar sequência | Ver | Desabilitados (sem mídia no V1) | Motivo só aparece no painel "O que entra no MP4" | BAIXA | `title` explicando |
| Multi-seleção, copiar/colar, ripple, extrair IN/OUT, stickers, efeitos, transições, FPS | - | NÃO TESTADO a fundo (sem mídia; só texto) | - | - | Ver "Não coberto" |

## 11. /workspace2 (redireciona para /workspace) - passos 3 e 4
| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| `/workspace2` | Abrir | Redireciona para `/workspace` | Rota alias sem aviso; ok | BAIXA | - |
| Indicador de passos | Clicar passo 3 "Timeline" | Mostra Timeline 2 embutida; o passo 1 permanece com destaque azul cheio e o passo 3 só ganha contorno claro | Ambíguo qual passo está ativo | MÉDIA | Marcar só o passo atual com a cor cheia; concluídos com check |
| Timeline embutida (passo 3) | Ver | Inspetor cortado na borda direita ("editar" cortado) | Largura (card) | BAIXA | Ver seção 10 |
| Passo 4 "Exportar" | Clicar | "Central de exportação": prévia, Projeto, Edição externa (XML/EDL/OTIO/PDF), Render e entrega, Edição em lote, Fila | Há três pontos de exportação (botão "Exportar" do topo, passo 4, seção do painel) | BAIXA | Unificar |
| "Renderizar sequência agora" com timeline vazia | Clicar | Nenhum feedback perto do botão; a mensagem "A trilha principal não possui clipes exportáveis." aparece só no topo da página (próxima a "Mídias selecionadas"), fora da tela | Feedback invisível para quem rolou até o botão (Workspace2Export.jsx:146) | MÉDIA | Exibir o aviso junto aos botões ou como toast fixo; desabilitar botões sem clipes |
| Edição em lote | Ver | "Criar lote (0)" com 3 opções marcadas por padrão | OK | - | - |

## 12. Melhorias óbvias (pequenas e seguras)
1. `frontend/src/index.css:23-48`: no `@media (min-width:1280px)` usar `flex-wrap: wrap` e `justify-content: flex-start` em `.mmfilm-project-actions` (corrige a sobreposição do cabeçalho do MMFilm).
2. `EffectCraftWorkspace.jsx:1307` (e 1318): remover `overflow-x-auto` da barra de menus ou renderizar o dropdown com `position: fixed`/portal.
3. `PhotoCraftWorkspace.jsx:641`: trocar o rótulo `["screen", "Divisão"]` por "Tela".
4. `FilmCraftWorkspace.jsx:1596-1607`: definir a aba ativa (sublinhado) a partir de `workspace`.
5. `VectorCraftWorkspace.jsx:986`: iniciar `appearanceOpen` como `false`.
6. `ThreeDCraftWorkspace.jsx:116`: desabilitar "Construir"/"Gravar" com `title="Em breve"` (ou implementar).
7. `Workspace2Export.jsx:~146`: mostrar o retorno de `renderNow` junto aos botões e desabilitar quando não houver clipe exportável.
8. `FilmCraftWorkspace.jsx:913`: substituir `window.prompt` por diálogo próprio.
9. `RemainingCraftWorkspaces.jsx` (MMLight, botões de ícone): adicionar `aria-label`.
10. Remover o emoji 🔥 usado como rótulo/estado vazio no Timeline 2 (`lib/captionTools.js`, `lib/timeline2Presets.js`, componentes de preview).

## 13. Sugestões para Alex decidir
- Manter duas mesas no MMSom ("completo" e "integrada") ou eleger uma.
- Largura mínima suportada das ferramentas gráficas: hoje elas pedem cerca de 1500 px com a sidebar aberta; decidir entre recolher a sidebar automaticamente, aceitar rolagem interna ou reduzir painéis.
- Formatos de exportação do MMFilm: expor só WebM (honesto) ou investir em MP4/H.264 real.
- Abas de ribbon sem função (Excel Dados/Revisão etc.): esconder ou manter com aviso.
- Unificar os pontos de exportação do Workspace (topo, passo 4, painel).
- Padrão de feedback: adotar um componente único de toast (hoje há notices no topo do cabeçalho, linha minúscula sob a timeline, texto cinza no MMPDF e `fixed top-20` no MMFilm).

## 14. Não coberto
- MMFilm: ferramentas Navalha, Ripple, Rate stretch, Slip, Caneta, Mão, Seleção de faixa com arrasto real (sem clipes; `window.prompt` bloqueado e sem como importar mídia); mixer; menus (exceto Gráficos e Títulos); Exportar de fato; "Salvar como/Recarregar".
- MMEffects: itens dos menus (invisíveis), render, quadros-chave.
- MMVector: demais ferramentas (Caneta bézier, formas, alinhar, pathfinder), Salvar/Exportar SVG/PNG (download).
- MMPhoto: Exportar PNG/PSD, Clone, Laço, ajustes e filtros restantes, camadas.
- MMLight, MMPDF (abrir PDF), MMDesign (Quadro por arrasto, Publicar PDF), MMLibs (adicionar ativos), MMSom "completo" (iframe, só visual), Word (B/I/U, digitação, Salvar).
- ClipsFree: todo o editor, painel de legendas (modelos, dividir/mesclar, SRT/VTT, desfazer), barra de ferramentas (formato, foco, durações, zoom), atalhos de teclado: exigem vídeo local, impossível no painel.
- Timeline 2: multi-seleção, copiar/colar, ripple, extrair IN/OUT, stickers, efeitos, transições (apenas texto, arrasto, divisão, painéis "O que entra no MP4" e atalhos foram testados).
- Workspace passos 1 e 2, "Enviar para fila", "Criar lote", exportações reais.
- Console/rede: o log do console tinha apenas avisos do React Router e 404s de recursos de sessões anteriores (não rastreados a esta sessão); não analisei requisições de rede.
- Não validei responsividade abaixo de 1280 px.

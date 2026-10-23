# Histórico · MCP em ícones nos apps gráficos e de documentos (20 a 23/10/2026)

Registro de tudo o que foi feito nas conversas "MCP · ferramentas em ícones" (sessão lateral criada pela conversa
"MCP MMFilm ferramentas e atalhos"). Serve para retomar o assunto em uma conversa nova sem depender do histórico do chat.

- Guia técnico do padrão (como funciona e como adotar em outro app): [MCP_FERRAMENTAS_EM_ICONES.md](MCP_FERRAMENTAS_EM_ICONES.md)
- Estado geral do projeto: [PROJECT_STATUS.md](PROJECT_STATUS.md)

## 1. Resumo em uma linha

Todos os 14 apps de **Ferramentas Gráficas** e de documentos agora mostram, no MCP do Copiloto, a mesma
**grade de ícones** do MMFilm (busca, guias, favoritos, detalhamento embaixo, Analisar = prévia, Aplicar, Fila e
Desfazer), cada um com **as funções do próprio app** — tudo executa de verdade; o que ainda não dá aparece como
"em breve" com o motivo, sem botão falso. Publicado na `main` pelo PR #8 (merge `51e2fc8`, 22/10/2026).

## 2. Linha do tempo

| Data | O que aconteceu | Onde ficou |
|---|---|---|
| 20/10 | Alex aprova a grade do MMFilm (commit `49f5677`) e pede para replicar em todos os MCPs. Pedido explícito: "só não repita as mesmas funções do MMFilm, só a forma de apresentar". | branch `feat/mmfilm-mcp-ferramentas` |
| 20/10 | 1ª rodada: MMPhoto (23) e MMEffects (21). | worktree `saas_001_mediamindai-mcpicones` |
| 20/10 | "Termina de todos e testa": MMVector (17), DesignCraft/MMDesign (16), MMSom (9). | idem |
| 20/10 | "Aumenta as ferramentas de cada uma": MMPhoto 30, MMEffects 25, MMSom 13 (auto contraste/nível/balanço de branco, formatos de redes, saídas e suavização, sequenciar, solo/mute/clipes). | idem |
| 21/10 | Essa 2ª rodada entrou na `main` pelo commit `0f5b91e` (PR #4, publicado por outra sessão a partir da worktree). | `main` |
| 21/10 | "Se vira e acha na internet": Remover fundo (pessoa com IA local + fundo liso), Exportar variações em .zip e Máquina de escrever no MMEffects (`textAt`). Corrigido o Desfazer do MMEffects. | worktree antiga (não commitada) |
| 22/10 | Pedido: levar os apps "no padrão antigo" (MMLight, PDF, 3D, Bibliotecas, Word, Excel, PowerPoint) para a grade. Nova worktree a partir do PR #6 (fundação nova do painel). A 3ª rodada foi trazida para ela. | worktree `saas_001_mediamindai-mcprestantes`, branch `feat/mcp-icones-apps-restantes` |
| 22/10 | "Pode fazer tudo o que for melhorar o sistema": Recortar objeto com IA (modelo `magic_touch`), Excel com grade que cresce, ferramentas "em breve" viraram reais (Excel, PowerPoint, Bibliotecas). | idem |
| 22/10 | "Figma e som ainda estão antigos": MMFig ganhou a grade; MMSom passou a mostrar a grade também com o "MMSOM completo" aberto; o Copiloto ganhou o rótulo do MMFig. | idem |
| 22/10 | "Termina de conferir e sobe": bateria completa verde, commit `4896099`, PR #8 aberto e mergeado pelo Alex (`51e2fc8`). | `main` |
| 23/10 | Fechamento: este documento. | branch `docs/historico-mcp-icones-2026-10-23` |

## 3. Como o padrão funciona (resumo)

- **Ponte app ↔ MCP:** `frontend/src/mediamind/lib/mcpActions.js` — o app aberto chama `registerMCPActions({ source, label, catalogue, analyze, apply, undo, canUndo })` só enquanto está ativo (`active`); ao sair, desregistra.
- **Painel:** `frontend/src/mediamind/components/mcp/MCPToolPanel.jsx` e `MCPToolFields.jsx` (fundação nova do PR #6: seções, `when`, `confirm`, `status:"soon"` + `soonReason`, chips, stepper, cor, texto, lista com checkbox, barra de última ação).
- **Catálogo por app:** um arquivo `xxxMcpTools.js` com `{ tabs, tools }` e `runXxxTool(id, estado, params)`. Cada `run` é **pura** sobre o estado do app e devolve `{ ok, summary, ...novoEstado }`; condição não atendida vira `{ ok:false, summary }` com a explicação. Nada é simulado.
- **Aplicar e desfazer:**
  - Pelo histórico do próprio app: MMFilm, MMPhoto, MMEffects, MMVector, MMDesign, MMFig, Word.
  - Apps sem desfazer próprio (MMSom, MMLight, PDF, MM3D, Bibliotecas, Excel, PowerPoint): o MCP guarda o estado anterior e **só desfaz se ninguém editou depois** (senão avisa e não sobrescreve).
- **Fila:** o estado é lido por `ref`, então várias ações seguidas funcionam antes de a tela redesenhar.
- **Testes:** cada catálogo tem teste unitário com **100% de cobertura** do arquivo de catálogo e um teste de integração com `currentMCPActions()` (registra só ativo, aplica mudando a tela, desfaz, `active={false}` → sem provedor).

## 4. Apps e ferramentas (estado publicado na `main`)

Contagem conferida no navegador em 22/10 (grade "Todos N" no Copiloto).

| App | Ferramentas | Arquivo do catálogo | Destaques | Em breve (motivo) |
|---|---|---|---|---|
| MMFilm | 52 | `mmfilmMcpTools.js` (+ módulos do PR #6) | edição IA (outra sessão) | 1 |
| MMPhoto | 34 | `mmphotoMcpTools.js` | Automático (auto contraste/nível, balanço de branco, correção rápida), **Fundo** (Remover fundo pessoa — IA local; **Recortar objeto** — IA local por ponto; Remover fundo liso), ajustes, filtros, camadas, seleção, Formato redes, **Exportar variações (.zip)** | — |
| MMEffects | 28 | `mmeffectsMcpTools.js` | animações de entrada/saída, quicar, tremor, suavização, **Máquina de escrever / Palavra por palavra**, efeitos reais, sequenciar camadas, marcadores ritmados | — |
| MMVector | 17 | `mmvectorMcpTools.js` | alinhar/distribuir/centralizar, espelhar, girar, repetir, organizar, recolorir, opacidade | — |
| DesignCraft (MMDesign) | 16 | `mmdesignMcpTools.js` | estilos de parágrafo, tamanho, caixa-alta, centralizar, ocupar página (sangria), duplicar, colunas, páginas | — |
| MMFig | 15 | `mmfigMcpTools.js` | alinhar/distribuir, grade, auto layout, duplicar em grade, frames de dispositivo, estilo de texto, trocar cor, cantos/sombra, renomear em lote, ordenar, componente, ligar telas (protótipo), exportar PNG/SVG | Estilos compartilhados (o formato `mmfig/v1` não guarda biblioteca de estilos) |
| MMLight | 15 | `mmlightMcpTools.js` | tom, recuperar, presença, perfil, looks, realce radial, gradiente céu, avaliar/sinalizar/coleção/sincronizar | Máscaras Assunto/Céu/Pessoas (precisam de IA de recorte) |
| PDF | 14 | `mmpdfMcpTools.js` | texto, link, cabeçalho/rodapé, marca d'água, nota, carimbo, marcar área, assinatura (não certificada), limpar anotações | OCR, Páginas, Senha/sanitizar, Converter (falta motor de PDF, ex. pdf-lib/pdf.js); Solicitar assinaturas (serviço externo) |
| MM3D | 15 | `mm3dMcpTools.js` | adicionar, série, isolar, centralizar, girar, organizar, cor/paleta, iluminação, giro 360°, entrada deslizando | Importar modelo GLB/OBJ e Renderizar (não há motor 3D real; o viewport é prévia CSS) |
| Bibliotecas | 17 | `mmlibsMcpTools.js` | filtros, favoritos, pastas (**guardam ativos e filtram a grade**), **etiquetas**, **lixeira com restaurar**, inventário, repetidos | Exclusão definitiva fica fora (precisaria de callback em `GraphicTools.jsx`) |
| MMSom | 13 | `mmsomMcpTools.js` | equilibrar pelos picos, volume, música sob a voz, estéreo, solo, silenciar, cadeia de voz, EQ, compressor, alinhar/sequenciar clipes | — (a grade aparece também com o "MMSOM completo"; aplicar abre a Mesa integrada) |
| Word | 16 | `wordMcpTools.js` | estilos, títulos, listas, sumário, localizar/substituir, maiúsculas, limpar espaços, palavras repetidas, estatísticas (texto sempre escapado) | Ortografia (sem dicionário pt-BR local), Notas de rodapé |
| Excel | 18 | `excelMcpTools.js` | ordenar, filtrar, duplicadas, totais/fórmulas reais, formatos, preencher série/para baixo, **cores por célula**, **formatação condicional dinâmica**, **gráfico SVG**; a grade cresce até a área usada | — |
| PowerPoint | 15 | `powerpointMcpTools.js` | slides, layouts, texto, **tema**, **alinhamento**, **anotações** (tecla N na apresentação) | — |

Detalhe completo de cada ferramenta: [MCP_FERRAMENTAS_EM_ICONES.md](MCP_FERRAMENTAS_EM_ICONES.md).

## 5. Inteligência artificial local (sem enviar foto para fora)

| Recurso | Modelo | Arquivo | Licença | Origem |
|---|---|---|---|---|
| Remover fundo (pessoa) | MediaPipe Selfie Segmenter | `frontend/public/models/selfie_segmenter.tflite` (já existia) | Apache-2.0 | — |
| Recortar objeto (por ponto) | MediaPipe Interactive Segmenter `magic_touch` | `frontend/public/models/magic_touch.tflite` (6,2 MB) | Apache-2.0 | baixado em 22/10 de `storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/` com autorização do Alex |

O WASM fica em `frontend/public/vision/wasm`. Adaptadores: `lib/personSegmentation.js` (`segmentPersonCanvas`) e
`lib/objectSegmentation.js` (`segmentObjectCanvas`). Medido no navegador: cerca de 0,4–0,6 s por recorte.
Limite conhecido: o modelo de pessoa marca ~4% de "pessoa" numa foto sem pessoas (o app só recusa abaixo de 0,5%);
Desfazer restaura.

## 6. Verificação (resultado real)

- Frontend completo (`npx vitest run`) antes da publicação: **221 arquivos, 1816 testes, todos verdes**; `npm run lint`, `npm run typecheck` e `npm run build` ok.
- Cobertura 100% (statements/branches/functions/lines) medida **por arquivo de catálogo** (`xxxMcpTools.js`) e nos adaptadores de IA; os componentes dos apps não foram medidos a 100%.
- Navegador local (porta 5185): as 14 grades aparecem no Copiloto; sem erros dos apps no console. Aplicar + desfazer reais conferidos em: P&B e Auto contraste (MMPhoto), Recortar objeto em foto real (mantém o letreiro, 82% transparente; desfazer restaura), Glow e Máquina de escrever (MMEffects), Espelhar (MMVector), Abrir estéreo (MMSom), Novo slide (PowerPoint).

## 7. Ambiente e máquina (o que foi mexido)

- **Docker Desktop** estava fechado: foi aberto e o Postgres subido (`docker compose up -d postgres`).
- **`.venv` da pasta principal** estava danificado (faltavam vários pacotes e o `cryptography` estava incompleto). Restaurado com `pip install -r requirements.lock` e reinstalação do `cryptography==50.0.1`, sem mudar versões.
- **`.claude/launch.json`** (local, fora do Git) ganhou entradas: `mediamind-web-mcpicones` (5179), `mediamind-api-mcprestantes` (8006, com CSRF da 5185) e `mediamind-web-mcprestantes` (5185). Podem ser removidas quando as worktrees forem apagadas.
- **Login local de teste:** botões "Acesso rápido por papel" da tela de login (contas demo locais).
- **Trava do Git:** o hook bloqueia qualquer `git merge` que cite "main" — inclusive trazer a main para uma branch de trabalho. Não foi contornado; o PR resolveu.

## 8. Worktrees e branches deste trabalho

| Item | Estado | Pode apagar? |
|---|---|---|
| `saas_001_mediamindai-mcpicones` (branch local `feat/mcp-icones-apps-graficos`, mudanças não commitadas) | Obsoleta: tudo foi para a `main` (`0f5b91e` e PR #8). Conferido em 23/10 que não há nada nela que falte na `main` — só versões antigas dos mesmos arquivos. | Sim, com ok do Alex |
| `saas_001_mediamindai-mcprestantes` (branch `feat/mcp-icones-apps-restantes`, remota também) | Mergeada (PR #8) | Sim, com ok do Alex |
| `saas_001_mediamindai-historico` (branch `docs/historico-mcp-icones-2026-10-23`) | Este documento | Depois de publicado |

## 9. Pendências e próximos passos sugeridos

1. **PDF de verdade:** adicionar um motor de PDF (ex.: `pdf-lib`, MIT) para Páginas (inserir/extrair/excluir) e exportação com anotações gravadas no arquivo; OCR e senha exigem outras peças.
2. **MMLight:** máscaras automáticas (Assunto/Céu/Pessoas) podem reaproveitar os modelos locais de recorte (`selfie_segmenter`, `magic_touch`).
3. **MM3D:** importar GLB/OBJ e renderizar dependem de um motor 3D real (o projeto já tem `three` nas dependências).
4. **Word:** ortografia (dicionário pt-BR local) e notas de rodapé.
5. **MMFig:** biblioteca de estilos compartilhados no formato do arquivo.
6. **Bibliotecas:** exclusão definitiva (callback em `GraphicTools.jsx`).
7. **Excel:** exportar CSV não leva cores, regras nem gráficos; células vazias não recebem cor de regra.
8. **Conferência visual:** tema claro/escuro e telas largas das partes novas (aba Design do PowerPoint, gráfico do Excel, lista de regras, Lixeira) — tarefa para `designer-ux`/`testador-qa`.
9. **Limpeza local:** apagar as worktrees obsoletas e as entradas extras do `launch.json` (seção 7 e 8).

## 10. Commits e PRs

| Referência | Conteúdo |
|---|---|
| `49f5677` | MMFilm: grade de ícones (base do padrão) |
| `0f5b91e` (PR #4) | 2ª rodada: MMPhoto, MMDesign, MMEffects, MMVector, MMSom |
| PR #6 (`adc361a`) | Fundação nova do painel + expansão do MMFilm (outra sessão) |
| `4896099` → PR #8 (`51e2fc8`) | Todos os apps restantes, MMFig, MMSom no modo completo, "em breve" reais, IA de recorte de objeto, exportar variações, máquina de escrever |

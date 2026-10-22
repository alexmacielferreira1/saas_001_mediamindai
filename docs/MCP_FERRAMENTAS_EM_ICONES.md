# MCP · Ferramentas em ícones (padrão reutilizável)

Primeiro uso: MMFilm (2026-10-20). Ideia inspirada no fluxo de painéis de plugins do Premiere (ex.: FX Master); nenhum código ou conteúdo licenciado (packs de SFX/presets) de terceiros foi copiado — os algoritmos foram escritos do zero.

## Como aparece
Coluna do Copiloto → seção **MCP**. Quando a ferramenta aberta registra um catálogo, o MCP abre sozinho com:
busca · guias (Todos, ★ Favoritos e as guias do app) · grade de ícones · ao clicar, o **detalhamento abre embaixo**
(descrição, "Como funciona", parâmetros, Analisar = prévia sem alterar, Aplicar agora, Adicionar à fila, Desfazer).
A fila do Copiloto executa as ações locais em ordem ("Executar fila") e para na primeira falha.
Destino/mídias/ferramentas do servidor continuam disponíveis, recolhidos.

## Peças
| Peça | Arquivo |
|---|---|
| Ponte app ↔ MCP (`registerMCPActions`, `useMCPActions`, `defaultParams`, `describeParams`) | `frontend/src/mediamind/lib/mcpActions.js` |
| Grade de ícones genérica | `frontend/src/mediamind/components/mcp/MCPToolPanel.jsx` |
| Integração na coluna e na fila | `frontend/src/mediamind/components/copilot/UniversalCopilot.jsx` |
| Catálogo e execução do MMFilm | `frontend/src/mediamind/components/graphic-tools/mmfilmMcpTools.js` |
| Catálogo e execução do MMPhoto | `frontend/src/mediamind/components/graphic-tools/mmphotoMcpTools.js` (registro em `PhotoCraftWorkspace.jsx`) |
| Catálogo e execução do MMEffects | `frontend/src/mediamind/components/graphic-tools/mmeffectsMcpTools.js` (registro em `EffectCraftWorkspace.jsx`) |
| Catálogo e execução do MMVector / DesignCraft (MMDesign) / MMSom | `mmvectorMcpTools.js`, `mmdesignMcpTools.js`, `mmsomMcpTools.js` (registro em `VectorCraftWorkspace.jsx`, `DesignCraftWorkspace.jsx`, `pages/SoundCraft.jsx`) |
| Operações puras do MMFilm | `lib/mmfilmEdits.js`, `lib/mmfilmAudioAnalysis.js`, `lib/mmfilmMotion.js`, `lib/mmfilmAudioMix.js` |

## Para adotar em outro app (MMPhoto, MMSom, Word…)
1. Escrever um catálogo `{ tabs, tools }`; cada tool: `id, tab, label, icon (lucide), description, how?, params[], analyze?: false, applyLabel?, run(state, params, env)`.
   Tipos de parâmetro: `range` (min/max/step/unit/help), `select` (options [[valor, rótulo]]), `toggle`, `multi` (options, empty), `info`.
2. `run` é pura: recebe o estado atual e devolve `{ ok, summary, details?, count?, ...novoEstado }`. Condições não atendidas viram
   `{ ok: false, summary: "explicação" }` — nunca simular sucesso.
3. No componente do app, enquanto `active`: `registerMCPActions({ source, label, catalogue, analyze, apply, undo, canUndo })`
   e devolver o cancelamento no cleanup do `useEffect`. `apply` deve passar pelo histórico do app (desfazer).
4. Testes: operações puras (unitário), painel/fila já cobertos; integração do app com `currentMCPActions()`.

## MMFilm — ferramentas (todas executam de verdade)
Auto Edit · Remover silêncios · Cortar nas pausas · Zoom automático · Punch in · Zoom suave · Camera shake · Pan · Rotação ·
Remover movimento · Normalizar · Auto ducking · Remover ducking · SFX automático (sons importados no projeto) · Limpar SFX.
Movimentos (`clip.motion`) e ducking (`clip.gainKeys`) aparecem no preview, na reprodução e na exportação WebM.

## MMPhoto — ferramentas (2026-10-22, todas executam de verdade · 34)
Fundo · Recortar objeto (2026-10-22): MediaPipe Interactive Segmenter com `public/models/magic_touch.tflite` (Apache-2.0, baixado de storage.googleapis.com/mediapipe-models), por ponto (centro da seleção ou X/Y em %); mantém o objeto ou apaga só o objeto. Adaptador em `lib/objectSegmentation.js`.
Fundo: Remover fundo (pessoa) com IA local — MediaPipe Selfie Segmenter (Apache-2.0) já servido em `public/models` e `public/vision`, a foto não sai do navegador ·
Remover fundo liso (cor dominante da borda, região conectada, contorno suave; respeita a seleção).
Automático (calculado do histograma real da camada): Auto contraste · Auto nível · Balanço de branco · Correção rápida.
Ajustes (camadas de ajuste não destrutivas, intensidade = opacidade): Preto e branco · Vintage · Vibrante · Mais brilho · Exposição · Contraste · Matiz · Inverter · Remover ajustes.
Filtros nos pixels da camada ativa (limitados à seleção): Desfoque · Nitidez · Ruído · Pixelizar · Nuvens.
Camadas: Sombra · Opacidade · Mesclagem · Duplicar · Centralizar/Redefinir · Mostrar todas. Seleção: Preencher · Limpar seleção.
Documento: Girar · Tamanho · Formato redes (1:1, 4:5, 9:16, 16:9, 3:1) · Exportar variações (.zip com original e formatos, PNG/JPG, largura máxima; `fflate`, não altera o documento) · Recortar na seleção.

`run` devolve `layers` (gravado com `commit`), `pixels` (passa por `applyPixelOperation`) ou `document` (rotação/tamanho/recorte reais); tudo entra no Histórico do MMPhoto.

## MMEffects — ferramentas (2026-10-21, todas executam de verdade · 28)
Texto: Máquina de escrever (letra por letra, cursor opcional) · Palavra por palavra · Texto inteiro. Base nova: `textAt(layer, time)` em `EffectCraftWorkspace.jsx`, usada no visualizador e na exportação; a camada guarda `textAnimation { mode, start, duration, cursor }`.
Animação (quadros-chave reais na camada selecionada, a partir de Transformar): Fade in · Fade out · Pop in · Deslizar · Sair deslizando · Encolher e sumir · Girar · Quicar · Tremor · Suavização (linear/suave/hold) · Limpar animação.
Efeitos (filtros reais no visualizador e na exportação): Desfoque · Brilho/contraste · Matiz · Glow · Sombra · Partículas · Remover efeitos.
Camada: Motion blur · Camada 3D · Ocupar tudo · Sequenciar (cascata) · Redefinir.
Marcadores: Marcadores ritmados · Limpar marcadores.
`run` devolve um `patch` do documento; o histórico por instantâneos do MMEffects registra a aplicação como um passo de desfazer.

## MMVector — ferramentas (2026-10-20)
Alinhar (seleção ou prancheta): Esquerda · Centro H · Direita · Topo · Centro V · Base · Distribuir H/V · Centralizar.
Transformar: Espelhar H/V · Girar · Repetir (cópias com deslocamento). Organizar: Para frente · Para trás. Cor: Recolorir · Opacidade.
Grava pelo `setObjects` do app (histórico de desfazer do MMVector).

## DesignCraft (MMDesign) — ferramentas (2026-10-20)
Texto: estilos de parágrafo (Título principal, Subtítulo, Corpo, Legenda, Crédito, Citação) · Tamanho · Caixa-alta.
Layout: Centro H/V · Ocupar página (margem ou sangria) · Duplicar · Para frente/trás. Páginas: Colunas de texto · Adicionar páginas.
Grava pelo `change()` do app (pilha de desfazer da publicação).

## MMSom (Mesa integrada) — ferramentas (2026-10-20)
Mix: Equilibrar (pelos picos reais do áudio) · Volume · Música sob a voz · Abrir estéreo · Centralizar · Solo · Silenciar · Limpar M/S.
Clipes: Alinhar início · Em sequência.
Inserts: Cadeia de voz (EQ Voz + compressor + centro) · EQ · Compressor.
Registra sempre que a aba MMSom está ativa — inclusive com o "MMSOM completo" (iframe externo) aberto; ao aplicar, o app mostra a **Mesa integrada**, onde o resultado aparece.
A mesa não tinha desfazer: o MCP guarda as faixas anteriores a cada aplicação e só desfaz se ninguém editou as faixas depois.

## Apps restantes (2026-10-22) — todos registram a grade só enquanto a aba está ativa
"em breve" = `status: "soon"` com motivo, sem botão de aplicar.
Sem desfazer próprio (MMLight, PDF, MM3D, Bibliotecas, Excel, PowerPoint): o MCP guarda o estado anterior e só desfaz se ninguém editou depois (padrão MMSom). O Word grava pelo histórico dele.

- **MMLight (15)** — `mmlightMcpTools.js`: Tom (Automático, Luz, Recuperar, Presença, Redefinir) · Cor e perfil (Perfil, Looks) · Máscaras (Realce radial, Gradiente céu, Limpar; *Assunto/Céu/Pessoas em breve: segmentação por IA*) · Catálogo (Avaliar, Sinalizar, Coleção, Sincronizar).
- **PDF (14)** — `mmpdfMcpTools.js` (camada de anotação; o arquivo não é reescrito): Texto, Link (http/https), Cabeçalho/rodapé, Marca d'água, Nota, Carimbo, Marcar área, Assinatura (não é assinatura digital certificada), Limpar anotações (confirma). *Em breve: OCR, Solicitar assinaturas, Páginas, Senha/sanitizar, Converter — precisam de motor de PDF (pdf-lib/pdf.js) ou serviço externo.*
- **MM3D (15)** — `mm3dMcpTools.js`: Adicionar, Série, Isolar/Mostrar todos, Centralizar, Girar, Redefinir, Organizar (linha/círculo), Cor base, Paleta, Iluminação, Giro 360°, Entrada deslizando, Limpar animação. *Em breve: Importar modelo (GLB/OBJ), Renderizar (não há motor 3D real).*
- **Bibliotecas** — `mmlibsMcpTools.js` (organização local; nenhum arquivo real é alterado ou apagado): Categoria, Pesquisar, Limpar filtros, Visualização, Favoritar visíveis (lista com checkbox), Limpar favoritos, Nova pasta, Renomear, Ordenar A–Z, Remover pasta, Mover para pasta, Esvaziar pasta (pastas guardam ativos e filtram a grade), Etiquetar (#etiqueta no cartão, seção Tags, pesquisa), Excluir ativos (vai para a Lixeira, com confirmação), Restaurar, Inventário, Repetidos. Exclusão definitiva fica fora (precisaria de callback em GraphicTools).
- **MMFig (15)** — `mmfigMcpTools.js` (histórico do próprio MMFig): Alinhar, Distribuir, Organizar em grade, Auto layout, Duplicar em grade, Frame de dispositivo, Estilo de texto, Trocar cor, Cantos e sombra, Renomear em lote, Ordenar camadas, Componente, Ligar telas (protótipo), Exportar PNG/SVG. *Em breve: Estilos compartilhados (o formato mmfig/v1 ainda não guarda biblioteca de estilos).*
- **Word (16)** — `wordMcpTools.js`: Estilo de parágrafo, Detectar títulos, Fonte, Alinhar, Listas automáticas, Transformar em lista, Remover listas, Sumário, Localizar e substituir, Maiúsculas/minúsculas, Limpar espaços, Palavras repetidas, Inserir parágrafo, Estatísticas. Texto dos parâmetros entra sempre escapado. *Em breve: Ortografia (sem dicionário pt-BR local), Notas de rodapé.*
- **Excel (15)** — `excelMcpTools.js`: Ordenar, Filtrar (para planilha nova), Remover duplicadas, Limpar espaços, Totais da coluna (fórmulas reais), Total por linha, Fórmulas em valores, Resumo, Formato de número, Negrito/itálico, Limpar formatos, Preencher série, Preencher para baixo (ajusta referências). Cores das células (fundo/texto), Formatação condicional dinâmica (`sheet.rules`: maior/menor/entre/igual/contém/N maiores/N menores, sobre o valor calculado), Gráfico de barras/linhas em SVG próprio (`sheet.charts`, relê o intervalo) e os removedores correspondentes. A grade cresce até a área usada (mínimo A–F/1–18; até 52 colunas × 500 linhas).
- **PowerPoint (15)** — `powerpointMcpTools.js`: Novo slide, Duplicar, Reordenar, Excluir (confirma), Tópicos em slides, Agenda, Aplicar layout, Padronizar layouts, Negrito/itálico, Caixa dos títulos, Substituir texto, Marcadores. Tema (6 prontos ou personalizado), Alinhar (auto/esquerda/centro/direita/justificado) e Anotações (painel no editor; tecla N no modo apresentação) — campos `theme`, `align`, `notes` por slide, também na aba Design.

## Pendências conhecidas
- Vícios de linguagem, legendas reorganizadas e títulos de frases fortes dependem de transcrição (ainda indisponível no MMFilm).
- Sincronizar câmeras e multicâmera dependem de mais de uma fonte por faixa e ficam para um próximo bloco.
- A timeline do MMFilm hoje tem indicador limitado a 60 s (comportamento anterior, não alterado).

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

## MMPhoto — ferramentas (2026-10-20, todas executam de verdade · 30)
Automático (calculado do histograma real da camada): Auto contraste · Auto nível · Balanço de branco · Correção rápida.
Ajustes (camadas de ajuste não destrutivas, intensidade = opacidade): Preto e branco · Vintage · Vibrante · Mais brilho · Exposição · Contraste · Matiz · Inverter · Remover ajustes.
Filtros nos pixels da camada ativa (limitados à seleção): Desfoque · Nitidez · Ruído · Pixelizar · Nuvens.
Camadas: Sombra · Opacidade · Mesclagem · Duplicar · Centralizar/Redefinir · Mostrar todas. Seleção: Preencher · Limpar seleção.
Documento: Girar · Tamanho · Formato redes (1:1, 4:5, 9:16, 16:9, 3:1) · Recortar na seleção.
Pendências MMPhoto: remover fundo (não existe segmentação no app) e exportar variações (vários downloads) ficaram fora do catálogo.
`run` devolve `layers` (gravado com `commit`), `pixels` (passa por `applyPixelOperation`) ou `document` (rotação/tamanho/recorte reais); tudo entra no Histórico do MMPhoto.

## MMEffects — ferramentas (2026-10-20, todas executam de verdade · 25)
Animação (quadros-chave reais na camada selecionada, a partir de Transformar): Fade in · Fade out · Pop in · Deslizar · Sair deslizando · Encolher e sumir · Girar · Quicar · Tremor · Suavização (linear/suave/hold) · Limpar animação.
Efeitos (filtros reais no visualizador e na exportação): Desfoque · Brilho/contraste · Matiz · Glow · Sombra · Partículas · Remover efeitos.
Camada: Motion blur · Camada 3D · Ocupar tudo · Sequenciar (cascata) · Redefinir.
Pendência MMEffects: efeitos de texto por caractere (máquina de escrever) precisam de animação por letra, que o editor ainda não tem. Marcadores: Marcadores ritmados · Limpar marcadores.
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
Só registra com a aba MMSom ativa e a **Mesa integrada** aberta (o "MMSOM completo" é um iframe externo, fora do alcance do MCP).
A mesa não tinha desfazer: o MCP guarda as faixas anteriores a cada aplicação e só desfaz se ninguém editou as faixas depois.

## Pendências conhecidas
- Vícios de linguagem, legendas reorganizadas e títulos de frases fortes dependem de transcrição (ainda indisponível no MMFilm).
- Sincronizar câmeras e multicâmera dependem de mais de uma fonte por faixa e ficam para um próximo bloco.
- A timeline do MMFilm hoje tem indicador limitado a 60 s (comportamento anterior, não alterado).

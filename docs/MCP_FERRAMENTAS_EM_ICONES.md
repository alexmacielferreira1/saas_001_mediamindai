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

## Pendências conhecidas
- Vícios de linguagem, legendas reorganizadas e títulos de frases fortes dependem de transcrição (ainda indisponível no MMFilm).
- Sincronizar câmeras e multicâmera dependem de mais de uma fonte por faixa e ficam para um próximo bloco.
- A timeline do MMFilm hoje tem indicador limitado a 60 s (comportamento anterior, não alterado).

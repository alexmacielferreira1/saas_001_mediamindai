# Auditoria — controles sem função nas Ferramentas Gráficas

Levantamento somente leitura em 19/10/2026 (branch `fix/pendencias-2026-10-19`). Nenhum arquivo foi alterado por ele. Caminhos relativos a `frontend/src/mediamind/components/graphic-tools/` salvo indicação. Contagens aproximadas; grupos gerados por `.map()` contam cada controle visível.

Legenda: **morto** = sem handler; **aviso** = só mostra mensagem; **falso** = altera estado que nada usa ou faz algo diferente do rótulo.

## Resumo por ferramenta

| Ferramenta | Referência | Funcionam | Mortos/falsos |
|---|---|---|---|
| MMFilm (`FilmCraftWorkspace.jsx`) | Premiere | ~70 | ~100 |
| MMEffects (`EffectCraftWorkspace.jsx`) | After Effects | ~55 | ~30 |
| MMVector (`VectorCraftWorkspace.jsx`) | Illustrator | ~35 | ~110 |
| MMPhoto (`PhotoCraftWorkspace.jsx`) | Photoshop | ~40 | ~45 |
| MMLight (`RemainingCraftWorkspaces.jsx` 19-252) | Lightroom | ~10 | ~30 |
| MMPDF (`RemainingCraftWorkspaces.jsx` 254-495) | Acrobat | ~5 | ~40 |
| MMDesign (`DesignCraftWorkspace.jsx`) | InDesign | ~8 | ~40 |
| MM3D (`ThreeDCraftWorkspace.jsx`) | Blender | ~25 | ~6 |
| MMLibs (`CraftLibraryWorkspace.jsx`) | Libraries | ~15 | ~4 |
| MMSom (`pages/SoundCraft.jsx`, mesa integrada) | Pro Tools | ~8 | ~15 |
| Word/Excel/PowerPoint (`pages/OfficeCraft.jsx`) | Office | ~12 | ~45 |

Código órfão: `CreativeWorkspace.jsx` (666 linhas) não é importado; arrays `accept` e `panels` de `tools[]` em `pages/GraphicTools.jsx` nunca são lidos; painel antigo do MMFilm (1175-1286) está desligado com `{false && …}`.

## Prioridade de correção

1. **MMFilm — exportação** (3036-3113, 2810-2821): "Exportar" baixa apenas `.mmexport.json`; "Iniciar fila" marca "Concluído" por `setTimeout` de 0,9 s. Precisa renderizar vídeo real (MediaRecorder/WebCodecs/ffmpeg.wasm) e fila verdadeira. Campo "Local" fixo em `C:\Users\Alex\Videos`; ~11 selects de exportação não são usados.
2. **MMFilm — menu** (2520-2581, 1049): 37 de 45 itens só exibem "comando preparado". Várias funções já existem (`saveProjectLocally`, `importProject`, velocidade no menu de contexto, área de transferência).
3. **MMFilm — ferramentas da timeline** (70-80, 1392, 831, 1648): Navalha, Ripple, Rate stretch, Slip, Caneta, Mão, Texto e Seleção de faixa só destacam o botão; o clique no clipe ignora `editTool`.
4. **MMPhoto — "Exportar PNG"** (251-263, 308): grava o texto "MMPhoto export" num `.png` (arquivo corrompido). Deve achatar camadas em canvas e usar `toBlob`.
5. **MMVector — Salvar/Exportar** (510, 525) mortos e nenhum desfazer/refazer no arquivo.
6. **MMEffects — Desfazer/Refazer/Salvar projeto** (65-75, 297-316) mortos; "Renderizar" (1021) sempre `disabled`; "Adicionar quadro-chave" (302) cria marcador.
7. **MMVector — ~50 ferramentas sem efeito** (46-125, 332-345, 486-497); alinhar, pathfinder e inverter mortos.
8. **MMDesign — Salvar, Publicar PDF, Adicionar página** (62, 77, 151) mortos; canvas estático.
9. **MMSom — importação** (20) guarda só o nome do arquivo; Salvar e Gravar (24) mortos; mute/solo/volume não afetam áudio.
10. **MMPDF — Salvar cópia, zoom, girar** (279, 340-347) mortos; **Office** — Salvar, Desfazer, B/I/U (OfficeCraft 18-41) mortos; fórmulas do Excel não avaliadas.

## Detalhes adicionais

- **MMFilm:** "Salvar como/Recarregar" (663-686) salva clipes mas não `media` — mídia some ao recarregar. Mortos: ⌂ (892), abas do mixer (2613-2616), pan/volume (2635, 2678), Fit/1/2 (2780-2781), destinos (2849), Metadados/Histórico (3204-3208), Transcrever (3630), Instalar template (3552), botões de faixa (1517-1532). Duplicados: Desfazer/Refazer/Dividir; "Restaurar layout" duas vezes (1092, 1116).
- **MMEffects:** prévia ◀◀ ◀ ▶▶ (1003), "Redefinir" (868), parâmetros de efeito salvos mas não renderizados (981-994), opções de camada/texto não usadas (1015-1016), medidores de áudio estáticos (1011).
- **MMPhoto:** pincel/caneta/borracha/clone/seleções simulados com pontos ou retângulo fixo (221-238); 16 ajustes (523-540) e filtros (655-672) mortos; sem refazer.
- **MMLight:** só 3 de 9 sliders afetam a prévia; abas de módulo, catálogo, Antes/Depois, máscaras e Sincronizar mortos; avaliação global, não por foto.
- **MM3D:** Construir/Gravar (116) mortos; `world.aspect` não usado; sem importar/exportar .glb/.obj apesar do `accept`.
- **MMLibs:** pastas (176) sem abertura nem conteúdo; "Sem pasta" igual a "Todos" (49-61); sem atribuição de tags.

## Referência externa

Os apps equivalentes de código aberto da conta GitHub `storytold` (filmcraft, effectcraft, vectorcraft, photocraft, lightcraft, pdfcraft, designcraft, soundcraft, wordcraft, gridcraft, deckcraft) usam licença Apache-2.0 e são aplicativos desktop em Rust. Servem como referência de comportamento; o MediaMind roda no navegador (React) e precisa de reimplementação própria, com atribuição quando houver aproveitamento de código.

# Relatório — pendências, Ferramentas Gráficas, ClipsFree, Timeline 2 e QA

Branch `fix/pendencias-2026-10-19`, **sem commit**. Trabalho de 19 e 20/10/2026.

## Resultado da bateria oficial `20261020-010318-974`

| Gate | Resultado |
|---|---|
| Backend (testes) | aprovado — cobertura 95,63% (meta 95%) |
| Frontend (testes) | aprovado — 152 arquivos, 995 testes (eram 603 no início) |
| Qualidade frontend (lint, typecheck, build) | aprovado |
| Qualidade backend (ruff) | **falhou só em `ai.py`, `ai_usage.py`, `test_ai_api.py`** (47 erros), arquivos do chat de IA, que não foram tocados |

Atenção: o `eslint.config.js` só analisa `src/components` e `src/pages`; **`src/mediamind` (quase todas as telas) fica fora do lint**. Os agentes rodaram as mesmas regras à força nos arquivos que tocaram (0 erros), mas o gate oficial não cobre essa pasta.

## O que foi feito

**Pendências de 19/10**
- MCP: falha por alvo registrada (fila `completed/partial/failed`), ferramenta indisponível recusada antes de salvar, alvo real da timeline aberta no Express, painel e Copiloto; bloqueio de execução sem mídia (antes lia o Acervo inteiro).
- Administração: suspensão vale só para a empresa (antes bloqueava o usuário em todas); novos Reativar e Encerrar sessões, com auditoria e testes de acesso cruzado.
- Mídia: registro sem arquivo dava erro 500 no stream; agora 404.
- Testes do frontend passaram a rodar no Node 26.

**Ferramentas Gráficas** (referências Craft, Apache-2.0, reimplementadas; layout preservado)
- MMFilm: ferramentas verticais reais (navalha, ripple, rate stretch, slip/slide, caneta, mão, texto, selecionar faixa), 45 itens de menu com ação ou aviso honesto, salvar com mídia, áudio A1–A3 tocando com mixer real, Programa em camadas, exportação WebM real, diálogo próprio no lugar de `window.prompt`, cabeçalho sem sobreposição em 1280/1440 px (verificado no navegador).
- MMEffects: desfazer/refazer, salvar/abrir, quadro-chave, nova composição, render WebM real, efeitos visíveis, menus visíveis.
- MMVector: ~40 ferramentas reais, Caneta Bézier, Lápis/Pincel à mão livre, Borracha por área, desfazer, salvar/abrir, SVG/PNG reais, menus, alinhar, pathfinder.
- MMPhoto: Exportar PNG/JPG real (antes gerava arquivo corrompido), pincel, borracha, clone, seleções, recorte, texto, 12 ajustes, filtros, refazer.
- MMLight, MMPDF, MMDesign: sliders reais, exportar, antes/depois, máscaras; zoom/girar/anotações no PDF; ferramentas, páginas-mestre e Publicar PDF real no MMDesign.
- Word/Excel/PowerPoint/MMSom: formatação real, fórmulas (SOMA, SE, intervalos), modo Apresentar, áudio real com Web Audio e gravação.
- **MMFig (novo, baseado no FigCraft)**: frames, formas, camadas, auto layout, componentes, protótipo com "Apresentar", exportação PNG/SVG.

**ClipsFree** (fluxo e layout preservados; SupoClip usado só pela lista de recursos, sem código)
- Legendas: geração com tempos reais, dividir/unir, 6 modelos (karaokê/neon), SRT/VTT, verificação de leitura e área segura, desfazer.
- Cortes: formato 9:16/1:1/16:9 chega à exportação, foco do enquadramento, durações, composição da nota, exportar todos.
- Editor (OpenCut): atalhos de teclado, zoom, quadro a quadro, ímã, forma de onda.
- Removidos candidatos de demonstração que apareciam como resultado de IA quando a análise falhava.

**Timeline 2** (OpenCut, MIT): multicamadas, seleção múltipla, copiar/colar, ripple por intervalos, extrair IN/OUT, stickers e textos, efeitos e transições, ondas de áudio, painel honesto "O que entra no MP4", timecode pela taxa do projeto e vários bugs corrigidos.

**QA de usabilidade** (`docs/QA_USABILIDADE_2026-10-20.md` e `docs/QA_USABILIDADE_FERRAMENTAS_2026-10-20.md`): links corrigidos, ~30 botões mortos que fingiam funcionar agora desabilitados com aviso, confirmações em ações destrutivas, avisos falsos removidos, sino/engrenagem do topo.

Créditos de licença: `THIRD_PARTY_NOTICES.md`. Referências em `D:\_referencias_craft` (fora do repositório, nunca executadas).

## Não verificado
- Renderização real de legendas no MP4 do ClipsFree (falta FFmpeg/libass nesta máquina).
- Reprodução de áudio e exportação WebM do MMFilm/MMEffects com mídia real (testados com simulação; telas abertas no navegador).
- Editor do ClipsFree no navegador (exige carregar vídeo local).
- Tema claro (seletor ainda não existe).
- A API em 8000 é de outro chat e roda código antigo: MCP e Administração novos só aparecem após reiniciá-la.

## Pendente — decisões de Alex
1. **Dados fictícios sem rótulo** em Analytics, Para publicação/Publicado, Em revisão, Home, Aprovação/Publicação do ClipsFree: selo "Demonstração" ou estado vazio. **Atualização 23/10/2026:** os exemplos deixaram de ser gravados no banco das empresas (PR #13); a exibição sem rótulo continua pendente. Ver `docs/RELATORIO_2026-10-23_DADOS_DEMO.md`.
2. **MCP**: reexibir Express e painel completo ou manter só o Copiloto (escondidos desde 16/10).
3. Telas duplicadas (/ingest, /search, /workspace, /social × abas do /corp): escolher a canônica; Acervo e Gestão no menu lateral.
4. Copiloto aberto por padrão ocupa ~40% da largura.
5. Ferramentas gráficas pedem ~1500 px com a barra lateral aberta: recolher a barra automaticamente ou aceitar rolagem.
6. Exportação do MMFilm: assumir WebM ou investir em MP4/H.264 real (servidor).
7. Áudio de clipes de vídeo em V1–V3 entra na mixagem do MMFilm (decisão do agente).
8. Duas mesas no MMSom; abas de faixa de opções sem função no Office; padrão único de avisos (toast).
9. Incluir `src/mediamind` no ESLint (provavelmente revela erros antigos).

## Pendente — trabalho
- Fila de 20/10: Administração pelas fotos, MCP, Canais Dark e gerador de vídeos, revisão geral.
- Lint/formatação de `ai.py`, `ai_usage.py`, `test_ai_api.py` (chat de IA).
- 404 a cada carga da Home: `records/{Project,Task,SavedSearch,RecentActivity,Library,IngestPackage}`.
- Aprovar/Recusar das telas por função operam sobre dados fictícios (desabilitados).
- Exportação multicamada no servidor (hoje só a faixa V1 do Timeline 2 vai para o MP4).
- MMPDF: organizar/proteger/OCR/gravar anotações exigem biblioteca de PDF; MM3D sem Construir/Gravar; XLSX no Excel; detecção de rosto/B-roll no ClipsFree.
- `window.prompt` restante em MMEffects, MMPhoto, MMLibs e MMPDF.
- Commit desta branch e PR (aguardando Alex; push na `main` publica no Render).

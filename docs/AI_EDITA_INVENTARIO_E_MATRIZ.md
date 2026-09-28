# Integração AI Edita — inventário e matriz inicial

Data da análise: 26/09/2026.

## Fontes preservadas

Os originais permanecem intactos em `C:\Users\Alex\Downloads`. A análise foi feita sem executar instaladores ou binários.

| Fonte | Tipo | SHA-256 | Uso |
|---|---|---|---|
| `26-20260926T174356Z-1-001.zip` | pacote de instaladores | `7FA3C0BB7CB102D832F1CE238785AB423E47B50CE1BDACDB40F1B7EF99C6F66A` | confirmação das distribuições Mac/Windows |
| `AI-Edita-Windows-x64.zip` | aplicativo Windows com fontes TypeScript/React/Next.js e runtime | `353C465672FBA6EB6BF0D691CB242865FC2F44CCAF39DD2CF33DBBF1D8496391` | fonte principal do inventário funcional |
| `AI-Edita-Legendas-Pro-v2.aiedita` | style pack JSON | `92B1B2D374F13A0AEB9DB95B661F6181A9F37D897CE50B8D1B5D838AA86A46EE` | 32 presets de legenda e comportamento sincronizado |

Conteúdo extraído para inspeção somente leitura em `work/ai-edita-analysis/`. Essa pasta é temporária e não faz parte do produto.

## Arquitetura encontrada no AI Edita

- aplicativo desktop distribuído com servidor Next.js portátil;
- editor React/TypeScript com gestores separados para projeto, timeline, seleção, playback, mídia, áudio, clipboard, render e salvamento;
- armazenamento local e schema próprio;
- renderização por Remotion, com filas e rotas de job;
- transcrição, legendas, biblioteca de elementos, sons, efeitos, templates e guias de plataforma;
- comandos reversíveis e registro central de ações/atalhos;
- suporte explícito a ripple, retime, tracks, keyframes, exportação e diagnóstico de desempenho.

## Matriz comparativa inicial

| Capacidade | AI Edita | MediaMind atual | Destino | Estado inicial |
|---|---|---|---|---|
| Seleção simples/múltipla | completa, com box selection | seleção principalmente visual/local | Timeline 2 | seleção simples implementada; múltipla/box pendentes |
| Tracks de vídeo/áudio/texto | modelo e comandos próprios | seis linhas visuais fixas no Workspace 2 | Timeline 2 + Workspace 2 | modelo real com 5 trilhas implementado |
| Adicionar/remover/reordenar tracks | sim | não funcional | Timeline 2 | adicionar e remover trilhas vazias implementado; reordenação pendente |
| Mover clipes | comando e interação | drop apenas acrescenta bloco | Timeline 2 | implementado no modelo e editor |
| Trim IN/OUT | modelo próprio | controles/valores visuais | Timeline 2 | implementado de forma não destrutiva |
| Split | comando reversível | botão apenas mostra aviso | Timeline 2 | implementado com undo/redo |
| Ripple | motor dedicado | botão apenas mostra aviso | Timeline 2 | ripple delete implementado por trilha; inserção ripple ainda pendente |
| Snapping | infraestrutura dedicada | ausente | Timeline 2 | implementado nas bordas dos clipes |
| Zoom e escala temporal | utilitários dedicados | slider sem efeito real | Timeline 2 | estado e escala visual implementados |
| Playhead/playback | gestor dedicado | controles visuais | Timeline 2 | playhead, seek, reprodução multicamada e navegação por frame implementados |
| Undo/redo | comandos/histórico | botões apenas mostram aviso | Timeline 2 | histórico local de até 100 alterações implementado |
| Clipboard/duplicação | elementos e keyframes | ausente | Timeline 2 | duplicação implementada; clipboard pendente |
| Marcadores | suporte no editor | botão apenas mostra aviso | Timeline 2 | marcador temporal implementado |
| Atalhos configuráveis | registro e persistência | atalhos globais fixos | Timeline 2 + configurações | Space/J/K/L, setas, Home/End, split, excluir e undo/redo implementados; configuração pendente |
| Waveform e áudio | gestor/recursos de áudio | sem waveform real | Timeline 2 | próxima fatia |
| Volume/mute por track | sim | UI visual | Timeline 2 | volume, mute e separação do áudio original implementados; mixagem avançada pendente |
| Retime/velocidade | presets e audio stretch | slider visual | Timeline 2 | playbackRate real implementado; stretch/render pendentes |
| Transcrição | modelos, idiomas e integração | contrato/IA ainda incompletos | Media Intelligence + Timeline 2 | depende de backend |
| Legendas | modelo, presets e sincronismo | painéis de legenda em Cortes | Timeline 2 + Cortes | presets importáveis primeiro |
| Style pack `.aiedita` | 32 estilos no pacote analisado | inexistente | biblioteca de legendas MediaMind | próxima fatia |
| Texto/formas/imagens | elementos e biblioteca | blocos limitados | Timeline 2 | texto, legenda e elementos básicos implementados; imagens avançadas pendentes |
| Keyframes/animações | sim | ausente | Timeline 2 | keyframes de transformação/opacidade, auto-keyframe e curvas hold/linear/smooth/Bézier implementados; graph editor avançado pendente |
| Efeitos/transições | registro e presets | UI/planejamento parcial | Timeline 2 | fatia avançada |
| Guias 9:16/1:1/plataformas | sim | formatos em Cortes | Timeline 2 + Redes sociais | próxima fatia |
| Templates/brand kit | sim | identidade parcial | Timeline 2 + Administração | próxima fatia |
| Exportação/render | Remotion e jobs locais | exportação profissional planejada | backend/jobs MediaMind | render local via backend, fila local, lote, aprovação e exportações MediaMind/XML/EDL/OTIO/PDF implementados; fila persistente de produção pendente |
| Projetos/autosave | store e persistência | rascunho local simples | Workspace 2 + Timeline 2 | handoff e persistência local implementados |
| Tema e preferências | recursos próprios | interface escura fixa | shell/configurações | avaliar após editor |
| Insights, agenda, fila e integrações | telas próprias | fluxos MediaMind mais amplos | manter domínio MediaMind | comparar sem transplantar produto |

## Regras de integração

1. Preservar Timeline, Workspace e todos os fluxos atuais.
2. Integrar a `Timeline 2` como Passo 4 do Workspace 2; manter a rota direta somente para compatibilidade, sem item duplicado no menu vertical.
3. Evoluir somente o `Workspace 2`, mantendo o Workspace original disponível.
4. Adaptar conceitos e contratos; não copiar identidade, domínio ou runtime do AI Edita.
5. Nenhum botão novo pode declarar sucesso sem alterar estado real ou chamar um backend real.
6. A origem de mídia permanece imutável; toda edição é não destrutiva.
7. Render, IA, transcrição e publicação exigem backend, jobs, autorização, auditoria e testes antes de serem marcados como implementados.

## Decisão de fluxo aplicada em 26/09/2026

O Workspace 2 passou a ter cinco etapas: `Pesquisa → Roteiro → Prévia → Timeline → Exportação`. O Passo 3 preserva sua composição e possui, na última coluna, o resumo e a entrada para a Timeline. O Passo 4 já é o editor completo no mesmo Workspace; não existe página intermediária. O Passo 5 centraliza prévia final, salvamento, intercâmbio, render, aprovação, lote e fila.

Essa separação evita duas timelines concorrentes e dá ao editor a área necessária para evoluir. O Workspace original, a Timeline original e seus caminhos permanecem preservados.

### Fundação operacional entregue

- rota protegida `/timeline2` mantida para compatibilidade e Timeline integrada ao Passo 4 do Workspace 2;
- documento de edição não destrutivo com trilhas de vídeo, texto e áudio;
- handoff do Workspace 2 e persistência local;
- seleção simples, playhead, zoom e snapping;
- mover, trim, split e excluir clipes;
- undo/redo com histórico de até 100 operações;
- importação de vídeos/áudios locais, biblioteca Projeto/Acervo e inclusão por ação ou drag-and-drop;
- preview reproduzível para arquivos locais e do Acervo, com controles reais no Passo 3, no editor e no Passo 5;
- barra lateral modular para Arquivos, Áudio, Texto, Elementos, Efeitos, Legendas e Ajustes;
- ferramentas reais de seleção, lâmina, trim ao playhead, duplicação, ripple delete e marcadores;
- agulha manipulável, handles de trim e controles de bloquear/ocultar/silenciar trilhas;
- inspetor real de X/Y, escala, rotação, opacidade, velocidade e volume, com keyframes, curvas e aplicação ao preview/player;
- trilhas adicionáveis/removíveis, áudio original separável, atalhos profissionais e navegação por frame;
- Central de Exportação com player final, projeto MediaMind, XML, EDL, OTIO, PDF, render imediato, fila, aprovação e lote;
- testes unitários do modelo, persistência, interface, rota e fluxo de quatro etapas.

### Limites reais desta fundação

Ainda não estão marcados como prontos: seleção múltipla/box selection, waveform real, clipboard, ripple insert, reordenação de trilhas, legendas sincronizadas por transcrição, efeitos avançados renderizados, graph editor completo, fila durável no banco/worker, IA real e publicação automática. O render local depende de FFmpeg; produção ainda exige storage, jobs, auditoria e homologação próprios.

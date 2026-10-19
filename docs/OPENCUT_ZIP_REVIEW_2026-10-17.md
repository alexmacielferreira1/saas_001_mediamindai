# OpenCut recebido: análise para o MediaMind

Data: 17/10/2026. Esta é uma análise estática, não uma homologação nem uma
implementação de editor. O ZIP de origem foi preservado, não foi executado e
nenhum arquivo de código ou dependência dele foi incorporado.

## Identificação e limites da fonte

- Arquivo fornecido: `C:\Users\Alex\Downloads\OpenCut-main.zip`.
- SHA-256: `3f22dacffe58daff8b08176fbe6053912a16a4a059e5d4e984dec9f6dffa6f61`.
- Inventário: 131 arquivos e 28 diretórios, sem links simbólicos; inspeção
  estática do arquivo, sem prova de comportamento em execução.
- A licença no ZIP é MIT, copyright 2026 OpenCut. Se código ou parte
  substancial for incorporado no futuro, preservar o aviso de copyright e a
  licença completa; avaliar também as licenças das dependências efetivamente
  adotadas. Nenhuma licença de dependência foi auditada nesta revisão.
- O README do próprio ZIP informa que o projeto está em reescrita e identifica
  `opencut-app/opencut-classic` como versão anterior. Nesta cópia, a rota web
  `apps/web/src/routes/editor.tsx` contém apenas “Coming soon”; o painel desktop
  `apps/desktop/src/panels/timeline.rs` contém apenas o texto “Timeline”.
  Portanto, este ZIP não disponibiliza uma implementação funcional desses
  editores para portar. A versão classic não foi obtida nem analisada.
- `changelog/0.3.0.md` descreve capacidades e decisões técnicas históricas,
  incluindo editor de curvas, recorte ripple, ondas de áudio, ticks inteiros e
  compositor GPU. Essas afirmações são referências da fonte, não prova de que
  o código correspondente esteja no ZIP nem de que funcione no MediaMind.

## Comparação com a implementação local

| Tema | Evidência local | Oportunidade e limite |
|---|---|---|
| Linha do tempo | `frontend/src/mediamind/lib/timeline2Model.js` contém movimento, recorte, divisão, exclusão ripple, snapping e keyframes; `Timeline2.jsx` conecta várias dessas operações à interface. | Preservar as operações existentes e testar seus resultados; a existência de funções não comprova a jornada completa. |
| Precisão temporal | `Timeline2.jsx` calcula o mostrador com 30 fps fixos; `timeline2Model.js` usa segundos numéricos e `document.fps`. FilmCraft exibe tanto 29,97 quanto 30 fps. | Priorizar uma representação e um timecode consistentes com a taxa real, inclusive taxas racionais; prever compatibilidade dos projetos já salvos. O changelog do OpenCut propõe ticks inteiros e taxas racionais, mas o motor descrito não está neste ZIP. |
| Ripple | `rippleDelete` desloca clipes por trilha somando durações dos removidos; a lógica não usa o algoritmo por intervalos descrito no histórico do OpenCut. | Antes de mudar, especificar lacunas, clipes sobrepostos, múltiplas trilhas e trilhas bloqueadas e testar preservação de sincronismo. Não presumir equivalência dos dois comportamentos. |
| Preview e exportação | `Timeline2.jsx` chama a API de exportação; `backend/app/api/v1/media.py` seleciona a trilha `v1`, ou a primeira trilha de vídeo, para renderizar. | Confirmar com mídia real o que o MP4 contém; não prometer composição integral de todas as trilhas, legendas ou efeitos sem evidência. |
| FilmCraft | `FilmCraftWorkspace.jsx` contém operações de edição e preview; o painel de exportação baixa um JSON de configurações, e a fila muda para concluída após temporizador. | Há risco de indicar conclusão sem vídeo renderizado. Esta observação é estática; validar a tela e conectar a renderização real ou desabilitar claramente ações não disponíveis quando o gate permitir. |
| Persistência | `useTimeline2Project.js` grava o documento atual em `localStorage` e mantém até 100 estados de histórico em memória. | Não tratar isso isoladamente como salvamento durável no servidor ou recuperação entre dispositivos. Verificar contrato versionado, falha de armazenamento e isolamento antes de expandir. |
| Bibliotecas | O OpenCut usa React 19, outro roteador e versões diferentes de componentes; o MediaMind usa React 18 e já possui componentes Radix e `react-resizable-panels`. | Evitar instalar ou atualizar uma pilha inteira só porque está no ZIP; avaliar cada dependência por necessidade, compatibilidade, licença e testes. |

## Ordem sugerida após liberação dos gates

1. Resolver os gates M0 pendentes registrados em `project-status.json` e
   `docs/PROJECT_STATUS.md`, sem descartar alterações locais ou reduzir testes.
2. Eliminar sucesso simulado de exportação no FilmCraft: conectar um fluxo real
   de renderização compatível com seu documento, ou desabilitar e explicar a
   dependência; validar o arquivo resultante e tratar falhas.
3. Especificar e testar tempo por quadro e taxas racionais, incluindo 24, 25,
   30 e 30000/1001, cortes, busca, limites e reabertura de projetos existentes.
   Definir explicitamente se haverá suporte a timecode drop-frame.
4. Cobrir ripple por intervalos com casos de espaços, seleção múltipla,
   trilhas bloqueadas e áudio/vídeo sincronizados; introduzir somente depois
   de definir a semântica desejada para o MediaMind.
5. Investigar formas de onda calculadas de mídia real e desenhadas apenas na
   área visível; medir uso de memória e desempenho antes de escolher biblioteca.
6. Avaliar composição e exportação multitrilha com vídeos, áudio, textos,
   efeitos, legendas e lacunas, incluindo isolamento por empresa e equivalência
   entre preview e arquivo final.
7. Se o usuário fornecer a versão classic ou autorizar sua obtenção, analisar
   código, histórico e licenças específicos antes de decidir qualquer port.

## Estado desta rodada

Somente documentação e análise estática; nenhuma alteração funcional, teste de
execução, instalação, migração, publicação ou modificação de produção. M0
permanece aberto/falhou segundo o último relatório, sem nova execução dos gates.

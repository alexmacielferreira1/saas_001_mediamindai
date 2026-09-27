# Timeline 2 e Workspace 2 — fundação inspirada no AI Edita

## Objetivo

Criar uma evolução observável do editor do MediaMind sem substituir fluxos existentes. A nova rota `Timeline 2` será um laboratório funcional acessível pelo menu vertical e o `Workspace 2` será o fluxo editorial que prepara e abre o mesmo projeto nela.

## Limites desta primeira entrega

A entrega implementa o núcleo local, não destrutivo e testável: modelo de projeto, tracks e clipes; seleção; playhead; zoom; snapping; mover; trim; split; excluir; undo/redo; persistência local; entrada pelo menu e passagem do Workspace 2 para a Timeline 2. Não implementa render real, transcrição real, IA real, upload ou publicação.

## Arquitetura

O estado deixa de ficar preso ao componente visual. Um módulo puro `timeline2Model.js` define o documento e todas as transformações. Um hook/store local pequeno persiste o documento por projeto e mantém pilhas de histórico. A página `Timeline2.jsx` compõe biblioteca, preview, inspetor e trilhas usando esse contrato. O Workspace 2 escreve no mesmo rascunho ao salvar ou enviar para edição.

A implementação usa React/Vite e os padrões visuais existentes do MediaMind. Não adiciona o runtime Next.js/Remotion do AI Edita nesta fase e não cria dependência de código externo.

## Modelo

- documento: `id`, `name`, `fps`, `duration`, `playhead`, `zoom`, `snapEnabled`, `tracks`, `markers`, `updatedAt`;
- track: `id`, `kind` (`video`, `audio`, `text`), `name`, `locked`, `muted`, `hidden`, `clips`;
- clip: `id`, `assetId`, `name`, `kind`, `trackId`, `start`, `duration`, `sourceIn`, `sourceOut`, `selected`;
- tempos são segundos decimais no domínio local e são formatados somente na interface;
- todas as operações retornam um novo documento e nunca alteram a mídia de origem.

## Comportamento e erros

- clipes não podem ter duração menor que um frame;
- split fora do intervalo útil não altera o documento;
- tracks bloqueadas recusam mover, trim, split e exclusão;
- snapping aproxima bordas e playhead dentro de uma tolerância proporcional ao zoom;
- importação de rascunho inválido usa documento padrão e informa o usuário;
- undo/redo preserva no máximo 100 estados e não registra alterações idênticas.

## Integração e navegação

- `/timeline2` usa a mesma permissão de módulo de Timeline;
- o menu vertical ganha `Timeline 2` sem remover itens existentes;
- o Workspace 2 mantém suas três etapas e o envio para edição também oferece abertura direta da Timeline 2;
- o estado atual do Workspace 2 é convertido para o documento da Timeline 2 sem perder blocos ou mídias selecionadas.

## Testes

Testes unitários cobrem todas as transformações puras, limites de frame, track bloqueada, snapping e conversão do Workspace 2. Testes de componentes verificam rota/menu, operações reais e persistência. A suíte completa, lint, typecheck e build devem passar antes de registrar a fatia como implementada.

## Evolução posterior

Waveform, áudio por track, atalhos configuráveis, marcadores, clipboard, legendas e o style pack entram nas próximas fatias. Keyframes, efeitos, transições, render e transcrição real exigem contratos adicionais e não serão simulados.


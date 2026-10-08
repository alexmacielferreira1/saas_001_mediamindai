# Criar Thumbs — desenho funcional

## Objetivo

Adicionar ao MediaMind principal uma área funcional de criação de thumbnails, acessível por `/thumbnails`, usando dados existentes sem alterar os registros de origem.

## Arquitetura

- O frontend lê `ProducaoProjeto`, `Project`, `Script` e a API de mídias já existentes.
- Um adaptador normaliza projeto, programa, episódio, roteiro, pessoas e imagens em um rascunho local editável.
- A composição é HTML/CSS responsiva com superfícies separadas para 1920×1080 e 1080×1920.
- A exportação usa `html2canvas`, já instalado, e gera PNG na resolução nominal de cada formato.
- Nenhuma nova tabela ou endpoint é criado. Uploads adicionais permanecem locais à composição por URL de objeto.

## Experiência

Quatro guias ficam na mesma página: Padrão SIMERS, Usar Referência, Criação Livre e Outros Templates. Padrão SIMERS abre primeiro e organiza a tela em dados, preview e dados do sistema em telas largas. As demais guias reutilizam o mesmo compositor e exportador.

O preset do programa aplica apenas cores conhecidas. `No Front` permanece sem padrão e encaminha para criação livre ou referência. Dados carregados exibem sua origem e continuam editáveis sem persistir no registro original.

## Limites

- Sem IA remota nova e sem botão de IA falso; a sugestão de chamada é local e determinística.
- Sem persistência de rascunhos de thumbnail nesta etapa.
- Pessoas são derivadas dos campos reais disponíveis; upload/troca de imagem é local.
- Apenas imagens do acervo entram como fotos sugeridas; vídeo e áudio continuam listados somente como origem de mídia quando aplicável.

## Validação

Testes cobrem presets, normalização de dados, navegação, edição sem mutar origem, seleção de formatos e acionamento de exportação. Build, lint, typecheck, suíte frontend e verificação visual local encerram a entrega.

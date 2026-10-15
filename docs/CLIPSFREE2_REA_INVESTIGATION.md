# CLIPSFREE2 — investigação REA do fluxo de cortes

Data: 15/10/2026

## Escopo e limite

O objetivo é construir uma ferramenta independente de cortes para o MediaMindAI, chamada `CLIPSFREE2`, com fluxo profissional baseado em mídia própria do tenant. A referência externa serve apenas para observar comportamentos. Este documento não autoriza cópia de código, marca, textos, identidade visual, imagens, nem tentativa de contornar autenticação ou desafios anti-bot.

`CLIPSFREE` permanece como versão existente e não será alterado durante esta investigação.

## Evidência REA

| Evidência | Cenário | Resultado |
|---|---|---|
| `ev_6e66694789e5097424f1d966a097af538f04a45a8293784535e576285c6a5166` | Entrada pública, navegador temporário | A página redirecionou para `/pt-br`. A captura de eventos registrou um desafio Cloudflare; nenhum desafio foi manipulado. |
| `ev_9a9ca0d6c39790bd4cd9d9f3b5440c01782467bca9c8867f9338eb75f5abd7f9` | Entrada pública, somente acessibilidade | Captura completa do conteúdo acessível da página pública, sem login, upload, envio de formulário ou uso de dados privados. |
| `ev_a684a34cd6078fff3727bcd03249ca10eda9bfefd068ef54e49b3ffb1e757ce3` | Painel autenticado, descoberta CDP | O REA confirmou uma página autenticada em `https://clip.opus.pro/dashboard`; a sessão e seus valores privados não foram coletados. |
| `ev_44b932648efd8993d84931acfad408cf147b47f2f2dfe48532d3b5640c9545cc` | Painel autenticado, inspeção passiva | Estrutura, acessibilidade e formas de tráfego observáveis foram coletadas sem clique, navegação, execução de JavaScript, upload ou processamento. A coleta começou após o carregamento da página; eventos anteriores não estão disponíveis. |
| `ev_5b2a564f02f777e2e6438af7b1132d396bad31142cc249c6ca6b38852da4710f` | Painel autenticado, captura de viewport | Captura passiva da tela inicial autenticada, sem rolagem, clique ou alteração de estado. |
| `ev_8f445997f71b74a6ab5e5a12688bb0457a25072b1f3d535a00133117d46a36ca` | Jornada autenticada, descoberta da configuração | A navegação da própria sessão chegou a `https://clip.opus.pro/workflow`; o REA não executou essa navegação. |
| `ev_480a80ae32fedcdfec3c84256949b4c8563cca1e1094ab90d424d7c77d0505e5` | Configuração pronta, inspeção passiva | Estrutura acessível da configuração, inclusive opções de templates de legenda, foi registrada antes do envio. Tráfego prévio ao acoplamento não está disponível. |
| `ev_c377badb7bfdb75e61e35b8ca76a4bb5ffc3d981745ac1b67fe1fc42c629abdb` | Configuração pronta, captura de viewport | Configuração de um vídeo próprio registrada sem iniciar a geração. |
| `ev_9af0d0e8eeb6ddf530469721f054598cceb9889950514716ade4742a9412aed2` | Projetos, inspeção passiva | A lista de projetos foi observada em modo somente leitura; a coleta começou depois da navegação e não contém tráfego anterior. |
| `ev_3d80edc8b6e149123207d6c4e02cee91c96178a23acec77e96490acba09f7bec` | Projetos, captura de viewport | A interface lista projetos de demonstração concluídos e seus respectivos totais de clipes. |
| `ev_57bacc0025491e2678abf7d16e79886d4e52ed5cb56cb9899f62f78aee6adf95` | Projeto concluído, descoberta CDP | Página de um projeto de demonstração aberto manualmente pelo usuário, em `https://clip.opus.pro/clip/demo-danny`. |
| `ev_34d577bba9502dea612062968ea6587bc6d4062800d0e53325b6a1cf6b081ba8` | Projeto concluído, inspeção passiva | Controles de lista de cortes, pesquisa/filtro e ações de postagem foram observados sem edição, exportação ou publicação. |
| `ev_62d15faaf243dfffc3b555c7a2edc9000c83ee93a3905bb094db03ce97c13362` | Projeto concluído, captura de viewport | Grade de 18 sugestões de cortes, com prévias, duração, título, nota e ações visíveis, registrada em leitura. |
| `ev_1954a5e944384401b6a73e39325dfb8c0a40bf70ac09a620b8da0773c2ee2659` | Corte individual, inspeção passiva | Modal de revisão aberto manualmente pelo usuário; controles de avaliação, download, exportação, publicação e duplicação foram observados sem interação. |
| `ev_bee31324bcacab956ccffcc24f30d733998de9504f2a7782314408a87f3d2b56` | Corte individual, captura de viewport | Prévia, intervalo, nota composta, análise textual e opções de saída do corte foram registradas em leitura. |
| `ev_263fc6a911dc944e61718329ea8e514516bf2db547b81e0c79295aa735f66305` | Trabalho próprio, descoberta de progresso | A página do trabalho iniciado pelo usuário foi encontrada em `dashboard?projectId=…`, com título de página indicando 16% e etapa `Clipping`. |
| `ev_4e2aa3ec8433176214f583691d437006b0fa7d3f39963619e9aba5c4a98e6798` | Trabalho próprio, inspeção passiva | O estado de progresso foi observado a 17%, com ETA apresentado de 5 minutos e controle de acompanhamento no painel. |
| `ev_0094e17970a34978aaf2be051dc78773507c72bbe90bb0d3992c3b2bfcafdac1` | Trabalho próprio, captura de viewport | Cartão de projeto recente apresentou 20% e ETA de 4 minutos; nenhuma ação foi tomada no trabalho. |
| `ev_2eee18b54d8592ef0300f484e87941d6a14962a3d401a8f8b6fc3ab0cf2f4227` | Trabalho próprio concluído, descoberta CDP | O projeto próprio concluído foi aberto manualmente em uma rota de projeto dedicada. |
| `ev_86acad4b5396a65a7ddae64729f79f0dc3166184b3c8dd8ae68daaf82b8102b3` | Trabalho próprio concluído, inspeção passiva | Lista de resultados disponibiliza seleção e um controle `Edit clip` por corte; nenhum controle foi acionado. |
| `ev_1ee5f9b6f9eb934115c5eb6d204ac7ef8d88695e5e677e4229d3d3da5fbff711` | Trabalho próprio concluído, captura de viewport | Seis cortes reais, suas notas, durações, legendas visíveis e ações por cartão foram registrados em modo leitura. |
| `ev_dafd175186b8590dbe575c4b971c357618fc5f2a0f75d8032033cd316a922867` | Revisão de corte próprio, inspeção passiva | Modal intermediário aberto manualmente: avaliação, regeneração, ferramentas IA, download, upscale, edição, duplicação, publicação e exportação XML foram observados sem execução. |
| `ev_2c026e8d0464811f837aa9e4757a0ca32c02676ffb3aec92d6b64a2610a24b7f` | Revisão de corte próprio, captura de viewport | Prévia, nota, dimensões da nota, título editável, análise de cena, trecho transcrito com tempo e ações habilitadas foram registrados em leitura. |
| `ev_516704e8d0daed1c4e88aac8f91c6cec559635d5753968cae3dfef5131a4d935` | Editor de corte próprio, descoberta CDP | O editor foi aberto manualmente em uma rota dedicada com identificadores de projeto/corte; tais identificadores não são requisito nem contrato da implementação própria. |
| `ev_b85b5e21b3652eec4a0cca079ef48f2642300ea0e427b5e69b1be3ee5449206a` | Editor de corte próprio, inspeção passiva | Controles de edição, transcrição, legendas, mídia, layout, tracker, timeline, IA e exportação foram observados sem edição nem exportação. |
| `ev_1c5d72731704a0c7061ce69c0acddef07ce9d897104960852a7be3b65b06e9ca` | Editor de corte próprio, captura de viewport | Editor com player vertical, transcrição temporizada por palavra, timeline de vídeo/áudio/legenda e ferramentas laterais registrado em modo leitura. |

### Complemento: observação controlada no navegador autenticado

Após a captura REA, o usuário autorizou explicitamente a manipulação reversível do corte de teste no navegador autenticado do Codex. Foram abertos, sem salvar, os menus de formato e layout. A seleção temporária do formato já ativo foi desfeita pelo comando `Undo`; o editor voltou a exibir `Save changes` desabilitado. Nenhuma exportação, download, publicação, upload, alteração de texto ou operação com créditos foi executada.

## Observado

- A página pública apresenta duas entradas: um campo para link de vídeo e um botão para carregar arquivos.
- A jornada pública direciona login/cadastro para o painel autenticado `clip.opus.pro/dashboard`.
- A página comunica recorte por IA, legendas por IA e reenquadramento por IA como capacidades diferentes.
- A página declara suporte a múltiplos idiomas e a diversas fontes por link no plano adequado.
- A mensagem pública promete criar vários clipes a partir de um vídeo longo, mas essa promessa não comprova o algoritmo, a qualidade, o número real de saídas nem os critérios de seleção.
- No painel autenticado observado, há uma entrada por link (com indicação de Twitch), além de ações distintas de upload e Google Drive.
- A tela inicial separa visualmente os modos de trabalho para vídeo longo em curtos, edição de vídeo, legendas, produção, B-roll, reenquadramento, efeitos sonoros, upscale, dublagem, melhoria de fala, gancho de voz e texto para vídeo. Isto prova que esses controles são apresentados, não que cada modo tenha sido executado nesta investigação.
- O painel apresenta projetos de demonstração e cartões de conteúdo; eles não foram abertos nem usados como substituto de uma jornada com mídia própria.
- Na configuração de vídeo observada, a interface expõe: idioma de fala, envio opcional de SRT, modelo de clipe, gênero, duração de clipe, headline automática, zoom automático, campo para momentos específicos, intervalo de processamento e presets/templates de legenda.
- Na captura, os campos de idioma, modelo, gênero e duração estavam em modo automático; headline e zoom automáticos apareciam desligados. O intervalo mostrava o vídeo completo de 4m42, ajustável por controles de início e fim.
- A tela informa um consumo de 4 créditos para iniciar esta configuração. Esse valor foi visto para essa sessão e esse vídeo; não é tratado como preço estável ou requisito da implementação própria.
- O usuário informou que escolheu 9:16 e uma legenda. A seleção de legenda é corroborada pela captura do preset marcado; a seleção 9:16 não estava no trecho visível da captura e permanece como relato do usuário, não como observação independente do REA.
- A lista de projetos expõe projetos de demonstração e o total associado de cortes (18, 12 e 25 nos três cartões visíveis). Isso comprova que a lista apresenta uma contagem, mas não comprova os critérios de seleção, a duração dos cortes ou uma taxa de sucesso.
- Um projeto concluído apresenta uma grade de sugestões agrupadas sob uma solicitação editorial. No exemplo, são 18 sugestões.
- Cada cartão visível combina prévia de vídeo vertical, duração, título, nota numérica e ações por ícone. Algumas sugestões também exibem uma etiqueta editorial. O projeto oferece pesquisa e filtro.
- As notas vistas nos cartões variam (por exemplo, 99, 96, 92, 89). A interface não mostrou, nesta captura, fórmula, pesos, limite de aprovação ou uma justificativa legível para cada valor. Portanto, a nota é observada como saída de ranking, não como previsão de viralização nem regra reproduzível.
- Há ação de postagem no projeto e ações de download por cartão. Elas não foram acionadas; não foi observado formato de exportação, integração social ou qualquer confirmação de publicação.
- Ao abrir uma sugestão, a interface mostra uma nota total de 99/100 no exemplo capturado e quatro dimensões individuais: Hook, Flow, Value e Trend. Os valores exibidos nessas dimensões eram categóricos (por exemplo, `A-`), não a fórmula de cálculo.
- O modal mostra uma prévia marcada como baixa resolução, um intervalo temporal do trecho e um bloco de análise textual de cena. Isso estabelece que a recomendação traz explicação textual contextual; não prova que essa descrição seja a fonte do ranking, nem que haja transcrição palavra a palavra disponível.
- O painel do corte apresenta ações de download, exportação XML, duplicação e publicação social. Na demonstração capturada, exportação XML, duplicação e publicação social estavam desabilitadas; download tinha menu. Nenhuma saída foi gerada.
- O processamento de um vídeo próprio cria um projeto recente e o expõe durante a execução. Foram observados título de etapa (`Clipping`), porcentagem e ETA, que evoluíram de 16% para 20% entre observações. O ETA variou de 5 para 4 minutos; portanto é uma estimativa dinâmica, não um compromisso de tempo.
- A tela de acompanhamento não exibiu nesta janela uma lista verificável de subetapas, tentativa, cancelamento, recuperação ou erro. Esses comportamentos permanecem não determinados até uma transição observável ou teste específico.
- O trabalho próprio concluído produziu seis cortes, todos apresentados em 9:16 na grade observada. As notas vistas foram 87, 84, 78, 71, 70 e 60; as durações visíveis variaram de 24 segundos a 2 minutos e 3 segundos. Essas medidas descrevem este teste, não uma promessa de quantidade, faixa de duração ou qualidade.
- Os cartões apresentam título, nota, duração, prévia com texto de legenda visível e ações de agenda, download e edição. Ao contrário do projeto de demonstração, o botão `Edit clip` está habilitado para cada corte do projeto próprio.
- Um aviso de `Auto headline` declara que uma headline foi acrescentada aos primeiros cinco segundos dos dez vídeos melhor ranqueados e aponta o editor para refinamento. O aviso oferece desativação, que não foi acionada. Não foi possível determinar, nesta tela, se a headline altera a mídia original, apenas a versão exportável ou uma camada de legenda.
- A revisão individual do corte próprio contém uma prévia, a nota total, quatro dimensões de nota, título com controle de edição, análise de cena e bloco de transcrição com intervalo temporal. No corte observado, o intervalo transcrito começou em `00:00` e terminou em `00:20`; não foi possível confirmar ainda a granularidade por palavra.
- Na revisão do corte próprio, `Export XML`, `Download HD`, `Upscale & download`, `Edit clip`, `Duplicate` e `Publish on Social` ficaram habilitados. O botão de upscale traz um marcador de crédito; não foi acionado. A existência desses controles não comprova formatos, preço, sucesso de exportação ou publicação.
- Um seletor/indicador de formato `9:16` está visível nesse nível de revisão. A implementação independente deve tratar formato e versão de render como configuração explícita e auditável, não como mera preferência visual.
- O editor do corte próprio apresenta texto de transcrição em blocos de palavra/trecho, cada qual com duração visível, sincronizado ao player. A interface também informa que as legendas podem ser reposicionadas. Isto comprova texto temporizado suficiente para edição de legenda; a semântica exata de cada duração e o comportamento após edição ainda precisam de uma ação controlada.
- Ao selecionar uma palavra visível da transcrição, foi aberto um menu contextual com `Add`, `Edit`, `Timing`, `Highlight`, `Delete` e `More`. O estado selecionado também expôs controles para remover e arrastar o parágrafo da legenda. Nenhuma dessas ações de mutação foi executada nesta captura; a seleção apenas tornou os comandos observáveis.
- Ao abrir `Delete` para a palavra selecionada, o editor apresentou duas ações distintas: `Remove caption & video` e `Remove caption`. Isto comprova que o produto oferece escolha explícita entre retirar a camada textual e retirar texto junto com a mídia associada. Nenhuma das duas ações foi acionada: ainda não foram observados o efeito na forma de onda, o comportamento de ripple, a duração final nem a recuperação via desfazer.
- Em teste controlado posterior, `Remove caption` aplicado à primeira palavra a marcou visualmente como removida no texto e ativou um controle de filtro com a instrução para ocultar partes removidas e sem transcrição. A duração do corte permaneceu em `02:02.25` na leitura da timeline imediatamente após a ação.
- Em outra palavra, `Remove caption & video` inseriu uma marca `Clip break` na posição da palavra: portanto é um corte temporal na mídia, e não mera ocultação de texto. A legenda visível do player passou a iniciar após o trecho removido e a duração exibida caiu de `02:02.25` para `02:02.19`. A imagem/fala após a quebra continuou presente. Isso evidencia uma edição temporal, mas não comprova ainda se o áudio sofreu ripple, se há lacuna oculta ou como fica o arquivo exportado. As duas alterações permaneceram não salvas.
- O comando `Timing` para uma palavra abriu controles de início, fim, reprodução do áudio associado, `Apply` e `Cancel`. A janela foi fechada por `Cancel`, sem alterar tempos. Isso comprova uma superfície de ajuste temporal por palavra; não comprova os limites válidos, a precisão ou o resultado ao aplicar.
- O comando `Add` para uma palavra apresentou `Add B-roll`, `Emoji`, `Text overlay` e `Voiceover hook`. Foram somente observados, sem inserção de conteúdo, upload ou consumo de crédito. Eles confirmam que o editor admite camadas/contextos adicionais vinculados a um ponto textual.
- A timeline visível separa conteúdo de vídeo, camada de legenda e forma de onda de áudio. Ela expõe controles de reprodução, zoom e uma duração total mostrada de aproximadamente dois minutos. Nenhum marcador IN/OUT foi ajustado nesta investigação.
- Controles visíveis do editor incluem crop, adicionar mídia, snap editing, desfazer/refazer, limpeza de fala, busca no script, capítulos, filtro de palavras apagadas, fundo, opções de exportação de legenda, layout, tracker, legendas, biblioteca, B-roll, movimento, texto, elementos, áudio, voiceover hook, extensão de clipe, IA, template de marca e exportação final.
- No estado inicial capturado, formato `9:16`, layout `Fill` e tracker desligado eram exibidos. `Save changes` estava desabilitado, coerente com a ausência de modificação; nenhuma mudança foi salva.
- O seletor de formato do editor apresentou quatro opções: `Vertical 9:16` (selecionada), `Square 1:1`, `Landscape 16:9` e `Portrait 4:5`. A seleção é uma configuração explícita no editor, não uma adaptação visual oculta.
- O menu de layout da cena apresentou `Fill` (selecionado), `Fit`, `Split`, `Three`, `Four`, `Picture in picture`, `ScreenShare` e `Gameplay`, além de uma entrada para configurações globais de layout. Foram apenas observados; nenhum layout foi aplicado ou salvo.
- O menu final de exportação apresentou quatro saídas: publicação/agendamento social, exportação XML para Premiere Pro ou DaVinci Resolve, upscale e download com promessa de HD ou 4K, e download HD. Também exibiu uma opção para remover marca d'água. O menu foi apenas aberto para leitura: não houve download, render, publicação, cobrança ou confirmação de formato/codec/arquivo resultante.
- A ação de exportação XML foi acionada para o corte de teste e concluiu com o download de um arquivo ZIP. Sem extrair ou alterar o conteúdo, a listagem do pacote confirmou vídeo MP4, áudio M4A, dois XMLs voltados a editores, SRT, JSON de legendas, assets de legenda e material de orientação de importação. Isso comprova uma exportação empacotada para continuidade em ferramentas externas; não comprova compatibilidade de importação, fidelidade do projeto, codecs, nem que os conteúdos representem edições ainda não salvas no editor.
- O usuário confirmou a conclusão posterior do download HD direto. A interface já expunha essa ação; a conclusão é registrada como relato do usuário. Não foi inspecionado o arquivo baixado diretamente, portanto formato/container, codec, resolução, duração e fidelidade desta saída específica continuam não determinados.
- Na conferência final da página do projeto, a grade apresentou seis cortes com as ações de calendário, download e edição. O primeiro cartão exibiu a marca `Edited`, confirmando que a edição retornou ao resultado do projeto. A captura final não estabelece quais alterações específicas foram persistidas, nem substitui uma verificação reproduzível do arquivo exportado.

## Inferido para a implementação própria

As decisões abaixo são de produto do MediaMindAI, não observações do OpusClip:

1. O `CLIPSFREE2` precisa tratar upload e URL como duas entradas explícitas. URL só deve ser aceita quando o conector nativo puder obter a mídia de maneira autorizada; caso contrário deve haver erro acionável, nunca simulação.
2. O processamento precisa ser uma esteira persistida: validação do ativo, extração de áudio, transcrição com tempo, seleção de candidatos, legendas, render e exportação.
3. Cada etapa deve publicar estado, porcentagem quando mensurável, mensagem pública, tentativa, horário e possibilidade segura de retomar ou cancelar.
4. Um corte sugerido só pode existir quando apontar para palavras/segmentos persistidos da transcrição. A nota editorial deve exibir suas dimensões e justificativa; não representa previsão de alcance.
5. Um editor profissional requer player no intervalo exato, IN/OUT, transcrição sincronizada, edição de legenda, estilos, formato e reprocessamento de render, preservando o vídeo original.
6. Todos os registros, arquivos temporários, saídas e permissões devem ser restritos a tenant, usuário e ativo autorizado.

### Requisitos relatados pelo usuário, pendentes de prova controlada

- A timeline permite adicionar camadas além das já visíveis. O comportamento preciso de inserção, ordem, tipos de camada e renderização ainda precisa ser observado em um teste específico.
- A edição por palavra permite retirar uma palavra de uma legenda e, conforme a ação escolhida, remover somente a legenda ou remover também o trecho correspondente de vídeo. O efeito exato sobre áudio, lacunas, ripple edit, tempo dos itens seguintes, possibilidade de desfazer e render final não foi executado nesta investigação; portanto é requisito de investigação, não fato comprovado pelo REA.
- A legenda pode ser reposicionada e a posição definida em um ponto deve persistir dali em diante, até haver uma nova alteração explícita. O comportamento esperado é uma sequência de keyframes/segmentos de posicionamento, e não uma posição global única para todo o corte. A criação e a transição visual desses keyframes ainda precisam de teste controlado.

## Ainda não determinado

Não foi possível verificar sem uma mídia própria de teste selecionada e autorização explícita para iniciar seu processamento:

- configuração após upload: idioma, perfil, duração, proporção ou prompt;
- progressão e mensagens reais da fila;
- número de candidatos, regra de pontuação e justificativa apresentada;
- player, ajustes de IN/OUT e relação com a transcrição;
- painel detalhado de estilo de legenda, templates, correções e comportamento da sincronização após uma edição;
- inclusão, reordenação e composição de múltiplas camadas na timeline;
- remoção de uma palavra com os modos “somente legenda” e “legenda + vídeo”, inclusive o efeito sobre áudio, timeline e exportação;
- rastreamento/reframe, B-roll, limpeza de áudio ou publicação;
- cancelamento, repetição, retomada e recuperação após falha;
- formatos e metadados do arquivo exportado.
- configuração detalhada de publicação social, remoção de marca d'água, upscale, limites de crédito e resultado efetivo de exportação.

Nenhum desses itens será preenchido com dados inventados. A próxima captura depende de um vídeo de teste que pertença ao usuário, escolhido por ele na sessão autenticada, e da confirmação antes de consumir créditos ou iniciar processamento externo.

### Limitação encontrada na abertura de um projeto

O REA conseguiu inspecionar passivamente a lista. A tentativa controlada de abrir um cartão de demonstração pelo mecanismo de cenário retornou falha interna do provedor antes de executar a ação; a página permaneceu em `/projects` e nenhum projeto foi modificado. Para continuar sem contornar esse limite, a abertura do projeto será feita manualmente pelo usuário e o REA retomará a inspeção passiva na página resultante.

## Estado local verificado

Existe uma rota atual `CLIPSFREE` e um domínio genérico de análise de clipes no backend. Ele já possui isolamento por tenant para ativo e análise, mas não comprova uma esteira profissional completa: a rota atual faz transcrição/análise de modo síncrono, não expõe editor de legendas, render/exportação ou uma fila durável ponta a ponta. O `CLIPSFREE2` será construído com estado, registros, cliente e rotas próprios, sem reaproveitar o estado local, componentes ou registros do `CLIPSFREE`.

# MediaMind AI — editor, operações e integração profunda dos conceitos do AI Edita

Data: 27/09/2026
Estado: desenho aprovado pelo usuário; especificação consolidada para revisão
Princípio: **preservar → comparar → melhorar**

## 1. Objetivo

Transformar o fluxo de edição do MediaMind AI em um sistema funcional de ponta a ponta, incorporando os recursos úteis identificados no AI Edita sem copiar sua identidade, seu produto ou seu runtime. O resultado deve continuar sendo reconhecível como MediaMind AI, preservar todos os recursos atuais e conectar Workspace 2, Edição, Acervo, IA, filas, exportação, publicação, insights e Administração sobre um mesmo domínio de projetos.

O editor não pode ser apenas cenográfico. Toda ação apresentada como disponível deve alterar o projeto real, acionar um serviço real ou permanecer claramente identificada como indisponível até que seu contrato exista.

## 2. Fontes e precedência

Esta especificação consolida:

- os ZIPs e o pacote de estilos fornecidos pelo usuário;
- a aplicação AI Edita em execução local e suas telas, menus, submenus e interações;
- o código-fonte distribuído dentro do pacote Windows;
- o frontend e backend atuais do MediaMind AI;
- o histórico funcional e os documentos vigentes do MediaMind;
- as correções e decisões explícitas do usuário nesta conversa.

Em caso de conflito, prevalecem a identidade e a arquitetura atuais do MediaMind, seguidas pelas decisões explícitas desta especificação. O AI Edita é referência funcional, não fonte de autoridade sobre marca, navegação, dados ou arquitetura.

## 3. Decisões normativas

1. Não substituir o MediaMind pelo AI Edita e não embutir o aplicativo Next.js portátil como segundo produto.
2. Não reconstruir o Passo 3 do Workspace 2 do zero.
3. O Passo 4 do Workspace 2 é o editor completo, já montado; não existe página intermediária de confirmação.
4. Remover a duplicidade visível “Material para editar”, mas preservar o estado interno `para_editar` como etapa “Entrada”.
5. Renomear “Em edição” para “Edição” e transformá-la na central unificada de produção e continuidade.
6. Reutilizar um único documento de edição e um único conjunto de operações entre Workspace 2, Edição e Timeline.
7. Uploads feitos em qualquer porta de entrada devem ser registrados no Acervo e vinculados ao projeto, respeitando permissões e empresa.
8. A edição é não destrutiva: a mídia original nunca é alterada.
9. A IA permanece sem nome próprio e atua por ferramentas autorizadas, com confirmação nas ações irreversíveis ou externas.
10. Configurações globais continuam pertencendo à Central; configurações do produto e da empresa pertencem à Administração do MediaMind; preferências pessoais pertencem ao usuário.
11. Nenhuma publicação, alteração em produção ou integração externa será executada sem autorização explícita e alvos confirmados.
12. Telas operacionais não podem depender de arrays mockados, URLs fictícias ou respostas de sucesso simuladas. Fixtures continuam permitidas exclusivamente dentro de testes automatizados.
13. No ambiente local, uploads, ingest, reprodução e edição usarão arquivos reais em armazenamento local controlado pelo backend. A futura troca por armazenamento definitivo ocorrerá por adaptador, sem reescrever o editor.
14. Todos os players do produto entram no inventário de migração e só serão considerados funcionais quando reproduzirem, pausarem, buscarem no tempo e tratarem duração/erro de uma mídia real.

## 4. Abordagem escolhida

### 4.1 Núcleo MediaMind compartilhado

Será criado um núcleo de edição pertencente ao MediaMind, com contratos estáveis para documento, comandos, mídia, playback, autosave, renderização e filas. A interface poderá evoluir sem duplicar regras de edição em componentes diferentes.

As alternativas rejeitadas são:

- copiar o AI Edita integralmente, pois criaria dois produtos, dois modelos de dados e duas identidades;
- transplantar apenas a aparência, pois manteria ferramentas cenográficas e o problema atual;
- manter Timeline 2 isolada como laboratório permanente, pois impediria continuidade real entre Workspace e Edição.

Timeline 2 permanece como rota observável durante a migração, mas passa a consumir o mesmo núcleo. Quando a equivalência e os gates forem comprovados, a nomenclatura final poderá ser simplificada sem remoção prematura das rotas antigas.

### 4.2 Arquitetura lógica

```text
Acervo / Upload
       │
       ▼
Projeto de edição ─── Workspace 2 (preparação)
       │                    │
       │                    └── Passo 4: Editor completo
       ▼
Documento não destrutivo + histórico de comandos
       │
       ├── Playback / preview / proxies
       ├── IA editorial e automações
       ├── Autosave / versões / colaboração futura
       └── Jobs
             ├── transcrição e legendas
             ├── análise e cortes
             ├── renderização e exportação
             └── publicação / agenda
```

### 4.3 Armazenamento local substituível

Durante os testes locais, o MediaMind usará o diretório ignorado pelo Git `.runtime/media/`, acessado somente pelo backend. A organização lógica será equivalente a:

```text
.runtime/media/
  <tenant-id>/
    <asset-id>/
      original/
      proxies/
      thumbnails/
      waveforms/
      captions/
      exports/
```

O nome fornecido pelo usuário será metadado, nunca caminho confiável. Arquivos físicos terão identificadores seguros, checksum e vínculo com tenant, ativo, projeto e versão. O banco local guarda metadados e relações; o sistema de arquivos guarda os binários. O contrato de armazenamento deve expor operações como gravar, abrir stream, verificar existência, excluir conforme política e criar URL autorizada, permitindo substituir a pasta local por objeto storage ou outro repositório no futuro.

O frontend nunca dependerá de `blob:` como persistência durável e não receberá caminhos físicos do computador. A API de mídia deve suportar streaming com MIME correto, tamanho, duração e requisições de intervalo (`Range`/`206`) para seek real. Formatos que o navegador não reproduz diretamente entram em processamento de proxy, preservando o original.

## 5. Modelo funcional do editor

### 5.1 Documento de edição

O documento deve suportar, no mínimo:

- projeto, empresa, proprietário, versão e datas;
- formato, resolução, FPS, duração, taxa de amostragem e fundo;
- cenas/sequências, trilhas e elementos;
- referências imutáveis aos ativos do Acervo e seus proxies;
- `sourceIn`, `sourceOut`, posição na timeline, duração e velocidade;
- transformações, opacidade, blend, áudio, efeitos, máscaras e keyframes;
- textos, formas, imagens, stickers, legendas e metadados editoriais;
- marcadores, guias, regiões e comentários futuros;
- configurações de snapping, ripple, zoom e visualização;
- vínculo com roteiro e blocos do Workspace;
- histórico de comandos, versões e estado de autosave;
- presets de exportação, destinos e jobs relacionados.

Tempos devem usar uma unidade canônica precisa no domínio e ser convertidos apenas na apresentação. Operações respeitam FPS, duração mínima de um frame e compatibilidade da trilha.

### 5.2 Comandos reversíveis

As operações do editor devem ser comandos testáveis, reversíveis e independentes da camada visual:

- selecionar, multisselecionar e seleção por área;
- inserir, mover, copiar, colar, duplicar e excluir;
- trim de entrada/saída, slip, split, split left/right e ripple;
- adicionar, remover, ordenar, bloquear, ocultar e silenciar trilhas;
- extrair/separar áudio e ajustar ganho, volume, fade e pan;
- alterar transformação, composição, velocidade, máscara e efeitos;
- adicionar/remover/reordenar efeitos e keyframes;
- adicionar marcadores e bookmarks;
- agrupar/desagrupar quando suportado pelo modelo;
- undo/redo com limite configurado e sem registrar estados idênticos.

### 5.3 Interação e usabilidade

O editor deve oferecer comportamento familiar a editores profissionais, sem copiar ícones proprietários:

- playhead arrastável e seek preciso;
- reprodução real do preview e sincronização com a timeline;
- drag-and-drop da biblioteca para trilhas compatíveis;
- arraste de clipes entre trilhas e no tempo;
- handles de trim, feedback visual, snapping e auto-scroll;
- régua, timecode, zoom horizontal, ajuste à duração e rolagem;
- waveforms e miniaturas geradas a partir de proxies;
- menus contextuais e atalhos configuráveis;
- seleção persistente e inspetor contextual;
- estados claros para mídia ausente, proxy em geração, job em andamento e erro;
- acessibilidade por teclado, rótulos e contraste.

O arraste deve funcionar tanto para incluir mídias quanto para reposicionar elementos e mudar camadas/trilhas compatíveis. Coordenadas visuais serão convertidas deterministicamente para tempo e trilha; o resultado só é confirmado após uma operação válida no documento. O playhead deve continuar utilizável durante zoom e rolagem e não pode perder eventos por sobreposição de painéis.

### 5.4 Composição da interface

O layout preserva a identidade MediaMind e organiza:

- barra superior: projeto, autosave, versão, configurações, exportação;
- coluna lateral de ferramentas: Arquivos/Acervo, Templates, Títulos, Áudio, Texto, Elementos, Efeitos, Transições, Legendas, Ajustes, IA e Projeto;
- biblioteca contextual na coluna esquerda;
- preview/canvas central com guias de formato e controles;
- inspetor direito para o elemento selecionado;
- barra de ferramentas imediatamente acima da timeline;
- timeline multitrilha na área inferior.

Ícones devem ser próprios ou de biblioteca licenciada já adotada no projeto. Recursos inspirados em Premiere/DaVinci significam padrões de interação, não reprodução visual da marca.

### 5.5 Inspetor de propriedades

O inspetor deve refletir e editar o estado real do item selecionado:

- transformação: X/Y, escala X/Y ou vinculada, rotação, âncora e recorte;
- opacidade, blend e composição;
- áudio: volume, ganho, pan, fade, mute e canais quando disponíveis;
- velocidade, duração e retime;
- texto: fonte, tamanho, peso, alinhamento, cor, fundo, contorno e sombra;
- legendas: estilo, destaque de palavra, posição e área segura;
- máscaras, efeitos, ordem e parâmetros;
- keyframes por propriedade com interpolação e editor de curvas;
- metadados do ativo e vínculo com o Acervo.

Sem seleção, o painel explica como selecionar um elemento. Seleção múltipla mostra apenas propriedades comuns e operações seguras.

## 6. Workspace 2

### 6.1 Passo 3 preservado

Antes da alteração será inventariado tudo que o Passo 3 possui. Preview, controles, informações, ajustes e ações atuais permanecem funcionais.

Na última coluna existente será adicionado um bloco compacto:

- título “Seu projeto está pronto para a Timeline”;
- mídias selecionadas;
- blocos de roteiro;
- trilhas iniciais;
- duração e outras informações reais disponíveis;
- botão “Abrir Timeline”.

Para acomodá-lo, áreas vazias e informações secundárias podem ser compactadas, sem eliminar controles ou comportamento do preview.

### 6.2 Passo 4

O clique em “Abrir Timeline” abre diretamente o Passo 4. O editor recebe:

- mídias selecionadas e sua ordem;
- roteiro, blocos e relações com mídias;
- trilhas iniciais;
- configurações de formato e projeto;
- metadados e demais escolhas dos passos anteriores.

O Passo 4 não mostra um novo cartão de prontidão. Ele monta o documento idempotentemente: reabrir não deve duplicar clipes. O projeto pode ser salvo e retomado pela página Edição.

## 7. Edição unificada

### 7.1 Consolidação

A análise do código confirmou que “Material para editar” e “Em edição” usam essencialmente a mesma tela; `initialLane` é passado por uma rota, mas não é consumido pelo componente. Portanto:

- retirar “Material para editar” do menu e das rotas visíveis;
- renomear “Em edição” para “Edição”;
- preservar `para_editar` no domínio como lane “Entrada”;
- redirecionar links antigos de forma compatível;
- manter histórico e auditoria das transições.

### 7.2 Central de produção

“Edição” apresenta visões filtráveis de Entrada, Em edição, Prontos, Agendados, Publicados, Falhas e Arquivados, conforme permissões. Cada registro pode incluir:

- status, progresso e responsável;
- projeto, origem e data;
- preview e mídias relacionadas;
- abrir/continuar na Timeline;
- histórico, versões e revisão;
- baixar resultado;
- exportar pacote/intercâmbio para edição externa;
- devolver, aprovar, agendar, publicar ou arquivar;
- erros, diagnóstico e nova tentativa.

Os recursos já presentes em `EdicaoPage` — filas, agrupamentos, histórico, metadados, revisão e Premiere XML — devem ser preservados e integrados, não recriados de forma inferior.

## 8. Edição em lote e filas

### 8.1 Criação do lote

Um lote pode receber arquivos do Acervo ou upload. O upload cria o ativo no Acervo antes de vinculá-lo ao lote. O usuário escolhe, por item ou para o conjunto:

- preset/template;
- corte editorial e remoção de pausas;
- transcrição, idioma e estilo de legenda;
- textos/títulos animados;
- formato, resolução, duração e redes de destino;
- renderização automática;
- exportação imediata, fila de exportação ou somente preparação;
- revisão obrigatória ou publicação/agendamento autorizado.

### 8.2 Orquestração

A fila deve ter estados explícitos, progresso persistente e idempotência. Um job não pode ser apenas simulado no frontend. Estados mínimos: aguardando, preparando, processando, revisão, renderizando, pronto, agendado, publicado, falhou, cancelado.

O sistema deve permitir pausar/cancelar quando tecnicamente seguro, tentar novamente sem duplicar saída, priorizar com permissão, abrir o projeto e inspecionar logs compreensíveis. Falhas parciais não invalidam itens já concluídos.

### 8.3 Exportação

Da Timeline, o usuário escolhe:

- exportar agora;
- adicionar à fila e iniciar;
- adicionar à fila e aguardar;
- exportar um pacote/intercâmbio externo quando suportado.

O resultado entra no Acervo como novo ativo derivado, ligado ao original, projeto, versão e parâmetros de render.

## 9. IA transversal e “Editar com IA”

### 9.1 Assistente sem persona nomeada

O prompt de IA já existente ganha acesso controlado a ferramentas do MediaMind para:

- consultar produção, projetos, fila, Acervo, agenda e insights;
- selecionar e preparar mídias;
- propor e aplicar cortes, preservando contexto;
- remover pausas conforme política;
- criar/transcrever/estilizar legendas;
- sugerir títulos, textos, formatos e versões;
- iniciar jobs e acompanhar resultados;
- planejar publicação com base em finais disponíveis;
- explicar dados reais de insights;
- abrir o item correto no editor para revisão.

Ações externas, publicação, exclusão e custos relevantes exigem confirmação e respeitam permissões. Toda ação deve ser auditável e informar o que foi alterado.

### 9.2 Prompts iniciais editáveis

- “Edite os vídeos selecionados: entenda a fala, preserve o contexto, remova pausas excessivas e crie legendas legíveis com destaques pontuais. Evite cortes e títulos genéricos.”
- “Mostre os vídeos finais disponíveis e me ajude a planejar as próximas publicações.”
- “Consulte os insights da conta selecionada e explique o que os dados realmente mostram.”
- “Como está a produção? Mostre o que está pendente, em edição e pronto para revisão.”

Eles são atalhos editáveis, não comandos rígidos nem respostas pré-fabricadas.

### 9.3 Página Editar com IA

A página oferece:

- upload com entrada automática no Acervo;
- seleção de ativos existentes;
- projetos em andamento e recentes;
- área de instrução e presets;
- resumo do plano antes da execução;
- progresso e resultados;
- abertura na Timeline para revisão manual;
- envio à fila, exportação ou publicação conforme permissão.

## 10. Legendas, mídia, efeitos e recursos avançados

O pacote `.aiedita` analisado contém 32 estilos e serve como referência de capacidades. Presets serão convertidos para um formato MediaMind versionado e validado, sem depender do formato externo em execução.

As entregas do editor devem cobrir progressivamente:

- transcrição real e correção manual;
- importação/exportação SRT e ASS quando compatível;
- legendas sincronizadas, destaque por palavra e áreas seguras;
- templates, títulos, elementos e brand kit por empresa;
- efeitos, transições, máscaras e ordenação de efeitos;
- freeze frame, separação de áudio e retime quando o pipeline suportar;
- guias e presets 16:9, 9:16, 1:1 e demais destinos;
- keyframes, curvas e interpolação;
- clipboard e operações multielemento.

Recursos dependentes de backend, codec, GPU ou serviços externos só serão marcados como completos após prova real no ambiente suportado.

## 11. Agenda, publicação e insights

Os conceitos úteis do AI Edita serão incorporados aos fluxos MediaMind existentes:

- Agenda trabalha com um ativo final validado, fuso, legenda/copy, canal e revisão do plano;
- publicação usa integrações oficiais e estados reais, sem números ou sucesso simulados;
- Insights consulta a conta selecionada, período e métricas reais, explicadas pela IA com origem identificável;
- Edição, Agenda, Publicação e Insights compartilham o mesmo ativo derivado e histórico.

Não serão criadas páginas paralelas se já houver um destino MediaMind superior; o recurso será adicionado ao destino existente.

## 12. Configurações e Administração

### 12.1 Preferências pessoais no MediaMind

- tema, idioma e acessibilidade;
- atalhos e preferências do editor;
- densidade, comportamento de playback e notificações pessoais.

### 12.2 Administração da empresa no MediaMind

- identidade visual, logos, cores, tipografia e brand kits;
- presets, templates, legendas, editor e exportação;
- integrações sociais e políticas de publicação;
- regras de IA e automações permitidas;
- filas, renderização, armazenamento e retenção do produto;
- usuários, papéis e permissões;
- padrões do Workspace e do editor.

### 12.3 Plataforma global na Central

- empresas/tenants, planos, limites e cotas;
- provedores globais, custos e disponibilidade de IA/render;
- feature flags e políticas globais;
- saúde de serviços, consumo e auditoria consolidada;
- integrações pertencentes à plataforma.

Como superadmin, o usuário pode alternar entre “Todas as empresas” e uma empresa específica, ver escopo claramente indicado e acessar a seção correspondente da Central. MediaMind e Central editam a mesma fonte de verdade por APIs; não haverá duas cópias da configuração.

## 13. Backend e contratos

A implementação deverá evoluir os contratos existentes, sem criar banco paralelo. Capacidades necessárias incluem:

- projetos e versões de edição por tenant;
- ativos, proxies, derivados e vínculos;
- autosave com controle de concorrência;
- jobs, etapas, progresso, tentativas e erros;
- filas e políticas de prioridade;
- presets e configurações por escopo;
- transcrição, render, exportação e publicação por adaptadores;
- auditoria de ações humanas e de IA;
- URLs temporárias e controles de acesso por empresa.

### 13.1 Upload e ingest reais no ambiente local

O endpoint de upload já existente em `.runtime/uploads` será aproveitado como ponto de partida, mas evoluído para o contrato completo de ativo. O fluxo mínimo é:

1. validar autorização, tipo, extensão e limite;
2. transmitir o arquivo para área temporária sem carregá-lo inteiro na memória;
3. calcular checksum e registrar o ativo no tenant correto;
4. mover atomicamente para `.runtime/media/<tenant>/<asset>/original`;
5. extrair metadados técnicos reais;
6. gerar thumbnail, waveform e proxy quando necessário;
7. tornar o ativo consultável no Acervo e disponível aos players/timeline;
8. informar progresso e falha de cada etapa sem declarar sucesso antecipado.

Uploads iniciados por Ingest, Acervo, Workspace, Timeline, Edição em lote ou Editar com IA devem convergir para esse mesmo serviço. Ingest deixa de ser uma demonstração isolada: pacotes, arquivos, progresso, validação e ativos resultantes precisam persistir e reaparecer no Acervo.

### 13.2 Eliminação de mocks operacionais

Será feito um inventário de todas as importações de `mediamind/data.js`, valores estáticos, caminhos fictícios e fallbacks de demonstração. Cada uso receberá um destino explícito:

- API persistente;
- configuração administrável;
- estado vazio real;
- fixture mantida apenas no teste automatizado.

Uma tela não poderá misturar silenciosamente dados reais e mockados. Durante a migração, qualquer dado de demonstração ainda visível deverá ser rotulado e isolado, e a conclusão do trabalho exige sua remoção dos fluxos operacionais.

### 13.3 Players e processamento de mídia

Todos os players — preview do Workspace, Timeline, Acervo, Edição, revisão, cortes, ingest e demais telas encontradas no inventário — devem consumir o mesmo contrato de reprodução. Esse contrato oferece:

- fonte reproduzível ou estado de proxy em processamento;
- metadados reais, poster/thumbnail e duração;
- play, pause, seek, volume, mute, velocidade e eventos de erro;
- retomada opcional de posição por projeto;
- sincronização do tempo com playhead e elementos da Timeline;
- limpeza correta de listeners e URLs temporárias.

Para formatos profissionais incompatíveis com o navegador, o backend preserva o original e cria proxy de edição. A Timeline usa o proxy para interação e o original para render/export quando o pipeline permitir. A indisponibilidade de codec deve produzir erro útil, nunca player vazio ou controles falsos.

Operações longas são assíncronas. O frontend observa o job por mecanismo suportado e tolera reconexão. Repetir uma requisição com a mesma chave idempotente não pode duplicar publicação, render ou ativo derivado.

## 14. Segurança, permissões e governança

- toda consulta e mutação deve ser limitada ao tenant da sessão, exceto escopo global explícito de superadmin;
- o escopo atual deve permanecer visível em ações administrativas;
- uploads validam tipo, tamanho, extensão e autorização;
- links de mídia são temporários quando necessário;
- segredos nunca chegam ao frontend nem à documentação;
- ações de IA usam as permissões do usuário e registram ferramenta, parâmetros relevantes e resultado;
- publicação, exclusão, cancelamento e alterações globais exigem confirmação proporcional ao risco;
- dados e domínio do MediaMind não serão copiados para a Central.

## 15. Migração e compatibilidade

1. Congelar e testar o comportamento atual antes de cada fatia.
2. Introduzir contratos compartilhados atrás das rotas atuais.
3. Converter rascunhos locais da Timeline 2 para o documento versionado, mantendo fallback e exportação de recuperação.
4. Redirecionar a rota removida “Material para editar” para “Edição”.
5. Manter Timeline original e Workspace original disponíveis até prova de equivalência.
6. Não migrar automaticamente dados destrutivamente.
7. Cada alteração de schema terá migração reversível ou plano explícito de rollback.
8. Atualizar a documentação e a matriz de capacidades a cada bloco.

## 16. Tratamento de erros e observabilidade

- erros devem indicar a etapa, o item afetado e uma ação possível;
- mídias ausentes, proxies pendentes e codecs não suportados têm estados distintos;
- jobs registram duração, tentativas e causa sanitizada;
- playback e timeline não devem perder o projeto por falha de mídia;
- autosave falho preserva uma cópia local recuperável e alerta o usuário;
- métricas cobrem filas, tempo por etapa, taxa de falha, render e uso de provedores;
- logs técnicos não expõem segredos nem conteúdo sensível desnecessário.

## 17. Estratégia de entrega

### Bloco A — correção de fluxo e preservação

- inventário e testes de regressão do Passo 3;
- mover o cartão de prontidão para a última coluna do Passo 3;
- tornar o Passo 4 o editor real;
- consolidar “Edição” e compatibilizar a rota antiga;
- manter Timeline 2 visível para acompanhamento durante a migração.
- inventariar mocks, players e todos os pontos de upload/ingest antes de substituí-los.

### Bloco B — núcleo funcional do editor

- documento versionado e comandos compartilhados;
- playback, playhead, drag, trim, split, snapping, ripple e trilhas;
- biblioteca Acervo/upload e inspetor real;
- autosave, undo/redo e atalhos.
- armazenamento local real, Acervo persistente, streaming com seek e proxies locais;
- migração dos players compartilhados e remoção dos caminhos de mídia fictícios.

### Bloco C — recursos editoriais avançados

- waveform, áudio, textos, legendas e estilos;
- efeitos, transições, máscaras, keyframes e curvas;
- templates, brand kit, guias e propriedades avançadas.

### Bloco D — jobs, filas e exportação

- edição em lote;
- transcrição/análise/render reais;
- exportação imediata ou enfileirada;
- ativos derivados, histórico, nova tentativa e intercâmbio externo.

### Bloco E — IA e continuidade operacional

- assistente transversal e página Editar com IA;
- prompts editáveis e ferramentas autorizadas;
- ligação com Edição, Agenda, Publicação e Insights.

### Bloco F — Administração e Central

- preferências pessoais;
- configurações da empresa no MediaMind;
- visão global de superadmin e ligação com a Central;
- auditoria, cotas, consumo e políticas.

Cada bloco precisa ser utilizável e testável por si só. Recursos não concluídos permanecem rotulados como pendentes; não haverá simulação de sucesso.

## 18. Verificação e critérios de aceitação

### 18.1 Workspace e continuidade

- Passo 3 mantém todos os recursos anteriores e exibe o novo bloco na última coluna;
- “Abrir Timeline” leva ao Passo 4 sem tela intermediária;
- mídias, ordem, roteiro, blocos e configurações aparecem corretamente no editor;
- reabrir o projeto não duplica conteúdo.

### 18.2 Editor

- arquivo local ou do Acervo pode entrar numa trilha compatível;
- play, pause, seek, playhead e preview permanecem sincronizados;
- mover, trim, split, duplicar, excluir, ripple, snapping e undo/redo alteram o documento real;
- propriedades selecionadas alteram preview e persistem;
- atalhos e menus contextuais executam as mesmas operações testadas;
- trilha bloqueada impede mutação; mute/visibility afetam playback/preview;
- autosave e recuperação funcionam após recarregar.
- playhead pode ser arrastado na régua e no corpo da Timeline mesmo após zoom/scroll;
- clipes podem ser arrastados no tempo e entre camadas/trilhas compatíveis sem travar;
- dois vídeos sobrepostos respeitam ordem de camada, visibilidade e composição no preview;
- arquivo recarregado do armazenamento local continua reproduzível, sem depender de uma URL `blob:` da sessão anterior.

### 18.3 Edição e fila

- não há duas páginas visíveis equivalentes;
- projetos podem ser retomados na Timeline e o histórico é preservado;
- lotes aceitam Acervo e upload;
- jobs reais exibem progresso, falha e nova tentativa;
- exportar agora e enfileirar produzem estados distintos e auditáveis;
- saída concluída entra no Acervo como derivado.
- upload iniciado em qualquer fluxo cria um ativo real e reaparece no Acervo;
- Ingest persiste pacote, arquivos e progresso e não usa sucesso simulado.

### 18.4 Players e ausência de mocks

- cada player inventariado reproduz ao menos uma mídia real suportada, pausa e busca no tempo;
- a API responde corretamente a requisições de intervalo e o seek não reinicia o download integral;
- mídia incompatível gera proxy ou erro explícito;
- nenhuma tela operacional obtém sua lista principal de `mediamind/data.js` ou arrays equivalentes;
- reiniciar frontend e backend preserva ativos, projetos e vínculos no ambiente local;
- fixtures e mocks permanecem somente nos testes automatizados.

### 18.5 IA, publicação e administração

- a IA consulta dados reais e só executa ferramentas permitidas;
- plano e mudanças ficam visíveis antes/depois da execução;
- publicação exige destino e confirmação corretos;
- preferências pessoais, empresa e plataforma não se misturam;
- superadmin vê o escopo global, mas ações permanecem auditadas.

### 18.6 Qualidade

- testes unitários dos comandos e conversões;
- testes de componentes para interações críticas;
- testes de integração dos contratos e jobs;
- testes ponta a ponta de Workspace → Timeline → fila → resultado;
- acessibilidade básica e navegação por teclado;
- lint, typecheck e build sem erros;
- comparação visual e funcional antes/depois;
- rollback documentado por bloco;
- documentação atualizada com implementado, preservado, adaptado e pendente real.

## 19. Documentação obrigatória

Devem ser mantidos atualizados:

- `docs/AI_EDITA_INVENTARIO_E_MATRIZ.md`;
- `docs/MAPA_DO_PROJETO.md`;
- `docs/RELATORIO_REESTRUTURACAO.md`;
- `docs/PROJECT_STATUS.md` e `project-status.json` quando o estado mudar;
- documentação específica do editor, jobs e integrações;
- decisões superadas, incluindo a antiga página intermediária do Passo 4.

Cada capacidade terá um dos estados: preservada, adaptada, implementada e verificada, parcialmente implementada, bloqueada por dependência real ou rejeitada com justificativa.

## 20. Fora do escopo imediato

- publicação em produção sem autorização explícita;
- cópia da marca, nome, aparência integral ou banco do AI Edita;
- prometer equivalência de codec/GPU sem validação no ambiente-alvo;
- remover Timeline/Workspace legados antes dos gates de equivalência;
- antecipar marcos do HUB ainda bloqueados apenas para acomodar esta integração.

## 21. Resultado esperado

O MediaMind passa a ter um fluxo coerente: preparar no Workspace, editar de verdade, automatizar individualmente ou em lote, revisar, renderizar, guardar no Acervo, exportar ou publicar, retomar depois e auditar tudo. Os conceitos superiores do AI Edita entram como capacidades MediaMind, somados aos recursos já existentes, sem descaracterizar o produto e sem manter duas experiências concorrentes.

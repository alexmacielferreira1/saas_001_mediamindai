# Administração 2 — detalhes contextuais e controles funcionais

Data: 02/10/2026

## Objetivo

Transformar a Administração 2 em uma experiência funcional dentro do próprio contexto. Todo item que aparenta ser interativo deve selecionar, expandir ou abrir detalhes na mesma tela. Atalhos não devem retirar o usuário da área atual nem perder filtros, seleção ou posição de trabalho.

O trabalho preserva as rotas, o backend e a identidade visual existentes. Ações sem suporte real permanecem indisponíveis e claramente identificadas; não serão simuladas como funcionais.

## Padrão de interação

A interface seguirá o padrão mestre–detalhe:

- a lista, tabela ou conjunto de cartões permanece como área mestre;
- o item selecionado abre um painel de detalhes na mesma tela;
- em telas largas, o detalhe ocupa a coluna direita;
- em telas menores, o detalhe aparece abaixo da lista ou em painel deslizante acessível;
- fechar ou voltar ao detalhe preserva filtros, busca, aba e seleção anterior;
- abas internas alteram somente o conteúdo do detalhe;
- o item selecionado recebe indicação visual e `aria-pressed` ou estado equivalente;
- botões indisponíveis usam estado desabilitado e texto que explica a dependência ausente.

Não serão usados redirecionamentos para outras telas como substitutos de detalhes contextuais.

## Tipos de controle

Cada elemento visual será classificado em uma destas categorias:

1. **Seleção contextual:** seleciona um item e atualiza o painel de detalhes.
2. **Expansão local:** abre conteúdo complementar sem sair da aba.
3. **Ação real:** executa operação existente no backend, com carregamento, sucesso e erro.
4. **Ação indisponível:** aparece explicitamente desabilitada, sem cursor ou aparência de ação ativa.
5. **Navegação de seção:** troca uma aba dentro da Administração 2 e preserva o contexto compatível.

Cartões informativos e métricas sem detalhe associado não receberão aparência de botão.

## Comportamento por área

### Visão Geral

- Indicadores com dados reais podem abrir a área correspondente dentro da Administração 2.
- Atalhos como usuários, perfis, importações e formulários abrem a seção interna correspondente.
- O destino deve destacar o primeiro item ou manter a seleção anterior, sem navegar para uma rota externa.
- Indicadores sem dados ou integração permanecem informativos e não clicáveis.

### Usuários

- Linhas da tabela, convites e o botão de detalhe abrem o mesmo painel de usuário.
- O painel mantém as subseções Visão Geral, Acesso, Funções, Equipes, Módulos, Permissões, Segurança, Atividade e Histórico.
- Subseções sem backend exibem estado vazio explícito dentro do painel, não um redirecionamento.
- Modo demonstração não dispara chamadas de alteração nem apresenta ações destrutivas.

### Perfis e Funções

- Cada perfil seleciona e atualiza o painel direito.
- Permissões, módulos e usuários vinculados serão itens inspecionáveis no próprio painel.
- Clicar em um usuário vinculado abre um subdetalhe contextual com retorno ao perfil selecionado.
- Edição permanece indisponível enquanto não existir endpoint específico.

### Acessos

- Manter o editor existente de acessos dentro da Administração 2.
- Controles de expansão, alternância e seleção devem responder e preservar a entidade ativa.
- Operações persistentes continuam usando somente APIs já existentes.

### Equipes

- Equipes abrem detalhes específicos de membros, unidade, setores e funções.
- Membros tornam-se selecionáveis e exibem detalhe local, com retorno à equipe.
- Busca deve filtrar a lista sem limpar a equipe selecionada quando ela ainda estiver visível.

### Formulários

- Selecionar um formulário atualiza a prévia e suas informações no painel direito.
- Campos continuam somente leitura até existir persistência real.
- A criação permanece identificada como indisponível, sem aparência de botão ativo.

### Importações

- Arquivo, mapeamento e erros de validação tornam-se selecionáveis para inspeção local.
- Linhas com erro exibem detalhe, origem e orientação no mesmo painel.
- Nova importação permanece desabilitada até existir fluxo real de upload e validação.

### Segurança

- Papéis, regras e eventos disponíveis podem ser selecionados para detalhe local.
- MFA, sessões e políticas sem endpoint permanecem estados informativos, sem controles falsos.

### Telas e Módulos

- Produto, módulo, tela, seção e widget seguem seleção hierárquica local.
- O detalhe mostra nível, identificador, visibilidade e ações esperadas.
- Nenhuma permissão é alterada enquanto o catálogo não for persistido.

### Cadastros

- Entidades selecionam sua definição, campos, vínculos e governança.
- Campos da tabela podem abrir detalhe de tipo, obrigatoriedade e fonte.
- Contadores preliminares devem ser rotulados como demonstração ou substituídos por `—`.

### Integrações

- Cada integração abre inventário, configuração conhecida, estado verificável e eventos disponíveis.
- Ausência de monitoramento real deve permanecer explícita.
- Credenciais nunca são exibidas, registradas em logs ou enviadas ao frontend.

### Configurações

- Seções alteram o formulário contextual sem perder alterações ainda não salvas.
- Salvar continua sendo a única ação persistente desta área e exige `permissions.manage`.
- Mudança de seção com alterações pendentes deve preservar o formulário atual.

## Componentes

Será criado um pequeno conjunto reutilizável dentro do domínio da Administração 2:

- `ContextDetailLayout`: organiza mestre e detalhe responsivos;
- `SelectableItem`: padroniza seleção, foco, teclado e estado visual;
- `ContextDetailHeader`: título, retorno, estado e ações permitidas;
- `UnavailableAction`: comunica dependência ausente sem simular funcionalidade.

Os componentes não conterão dados de domínio. Cada aba fornecerá item selecionado, conteúdo de detalhe e callbacks.

## Estado e fluxo de dados

- A aba ativa continua refletida no parâmetro `tab` da URL.
- Seleções internas permanecem em estado local da aba.
- Filtros e buscas não serão resetados ao abrir ou fechar detalhes.
- Dados reais continuam vindo das APIs atuais.
- Dados de demonstração são identificados no modelo apresentado à tela e não acionam mutações.
- Falhas de detalhe mantêm a lista visível e exibem erro somente no painel contextual.

## Acessibilidade

- Itens selecionáveis usarão botão semântico ou linha com botão de detalhe explícito.
- O item ativo expõe `aria-pressed`, `aria-selected` ou padrão equivalente.
- Painéis móveis terão título acessível, foco inicial e retorno de foco ao item de origem.
- Teclado deve permitir selecionar itens, alternar subseções e retornar à lista.
- Controles desabilitados informam o motivo em texto visível.

## Tratamento de erros

- Erro ao carregar um detalhe não fecha a lista nem perde o item selecionado.
- Erro de autenticação apresenta necessidade de sessão sem substituir dados por valores inventados.
- Erro de autorização informa a permissão necessária.
- Operações persistentes bloqueiam cliques repetidos durante o envio.

## Testes

Os testes da Administração 2 devem cobrir:

- todos os controles com aparência clicável;
- seleção e troca de detalhe em cada aba;
- preservação de filtros e seleção;
- retorno do subdetalhe para o item anterior;
- comportamento responsivo lógico do painel;
- navegação por teclado e atributos acessíveis;
- modo demonstração sem mutações ou chamadas indevidas;
- ações indisponíveis realmente desabilitadas;
- erros de carregamento restritos ao painel de detalhe;
- persistência de configurações e autorização existente.

Além dos testes direcionados, serão executados lint, verificação de tipos, build, suíte frontend completa e suíte backend quando houver alteração de contrato.

## Fora de escopo

- Criar endpoints novos para funcionalidades ainda não integradas.
- Inventar dados, métricas, estados de saúde ou histórico.
- Alterar rotas públicas, autenticação, tenant ou modelo de permissões.
- Substituir a Administração atual ou remover as prévias preservadas.
- Implementar criação de equipes, formulários, importações, integrações ou catálogo sem contrato backend validado.

## Rollback

O trabalho será dividido em commits pequenos por padrão de interação ou grupo de abas. Cada commit poderá ser revertido sem alterar banco ou migrations. O endpoint de configurações existente não será modificado sem necessidade comprovada.


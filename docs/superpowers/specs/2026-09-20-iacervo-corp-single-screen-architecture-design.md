# IAcervo Corp - arquitetura única de telas e fidelidade visual

Data: 20/09/2026

## Objetivo aprovado

Fazer o IAcervo Corp acompanhar as imagens de referência do documento de ajustes sem criar uma segunda versão das telas. Cada tela hoje acessada por uma guia de perfil deve ser o mesmo componente que será acessado pela futura navegação em colunas. A troca posterior de guia por coluna deve alterar apenas a navegação, nunca o conteúdo, os dados ou as permissões.

## Princípios

- Uma tela funcional tem uma única implementação.
- Guia, seletor de perfil, atalho, pesquisa e futura coluna apontam para o mesmo identificador de tela.
- Admin e superadmin enxergam todo o catálogo; os demais usuários recebem somente telas efetivamente permitidas.
- O perfil define a visão inicial e o conjunto permitido, mas não cria cópias da tela.
- O visual atual do MediaMind continua como base de identidade; densidade, hierarquia e composição devem se aproximar das referências.
- Dados inexistentes não serão simulados como reais. A interface usa estado vazio, indisponível ou "aguardando integração".

## Arquitetura

### Catálogo canônico de telas

`corpTabs.jsx` evolui para um registro canônico. Cada entrada terá, no mínimo:

- identificador estável;
- nome e ícone;
- componente renderizado;
- área funcional;
- permissões necessárias;
- metadados de navegação para guia e futura coluna.

`Corp.jsx` deixa de selecionar componentes em uma longa sequência de condições. Ele resolve a tela ativa pelo catálogo e renderiza o componente registrado. Isso elimina a possibilidade de a guia abrir uma implementação e a coluna futura abrir outra.

### Navegação atual e futura

No primeiro estágio, o seletor compacto de perfis permanece. As guias internas continuam funcionando, mas passam a consumir o catálogo único. A futura navegação em colunas será um adaptador do mesmo catálogo, mantendo os mesmos ids, URLs, componentes e regras de acesso.

Deep links continuam no formato `/corp?tab=<id>`. Um destino não permitido retorna à primeira tela autorizada. Admin e superadmin recebem o catálogo completo, inclusive Administração.

### Compartilhamento entre perfis

Telas comuns - início, agenda, tarefas, mídia/acervo, produção, aprovações, publicações, relatórios e administração - serão extraídas como componentes funcionais reutilizáveis. Cada perfil poderá fornecer contexto, filtros iniciais e ações permitidas, sem duplicar o corpo da tela.

Subtelas exclusivas permanecem específicas quando a regra de negócio realmente divergir. Diferença de rótulo, posição ou filtro não justifica uma cópia.

## Direção visual

As referências de Gestão, Acervo e Administração definem o padrão:

- cabeçalho baixo, com título, subtítulo, período e ações no mesmo eixo;
- primeira faixa de KPIs compactos e alinhados;
- painéis escuros com bordas discretas, espaçamento uniforme e maior densidade de informação;
- grade responsiva que preserve leitura operacional;
- tabelas com cabeçalho persistente, estados por cor e ações contextuais;
- gráficos ou barras somente quando derivados de dados reais;
- alertas e gargalos visíveis, com destino acionável;
- estados vazios visualmente integrados, sem números fictícios.

A implementação não copiará logotipos ou dados ilustrativos das imagens. Ela reproduzirá composição, proporções, hierarquia e comportamento usando a identidade e os dados do MediaMind.

## Ordem de implementação

1. Criar o registro único de telas e substituir a cadeia condicional do `Corp.jsx`.
2. Cobrir resolução, permissão, deep link e acesso integral de admin/superadmin.
3. Criar o shell visual compartilhado para cabeçalho, KPIs, grade operacional, tabela e alertas.
4. Migrar primeiro Gestão, Acervo e Administração, pois possuem referências mais completas.
5. Migrar cada perfil para o mesmo catálogo, começando pelas telas comuns.
6. Validar visualmente em desktop e largura reduzida contra as referências.
7. Somente depois trocar as guias por colunas, como alteração isolada de navegação.

## Dados e backend

Cada tela consome serviços locais tenant-scoped. Agregações gerenciais são calculadas no backend. Auditoria permanece append-only. A UI não recebe `tenant_id` confiável do navegador para definir escopo; o servidor deriva a empresa da sessão.

O shell compartilhado não conhece entidades de negócio. Cada tela fornece seus dados, ações, estados de carregamento, erro e vazio. Isso permite reaproveitamento no HUB sem forçar todos os SaaS a terem os mesmos módulos.

## Tratamento de erros

- Falha de API: estado de erro com tentativa novamente, sem substituir por mock.
- Tela sem permissão: negar por padrão e retornar à primeira autorizada.
- Tela desconhecida em deep link: retornar ao destino seguro do perfil.
- Integração externa ausente: informar indisponibilidade, sem inventar métricas.
- Configuração antiga no navegador: nunca reduz acesso de admin/superadmin nem substitui autorização do servidor.

## Testes e aceite

- Testes unitários do catálogo e dos adaptadores de navegação.
- Testes de todos os papéis, com destaque para admin e superadmin.
- Testes de deep links permitidos, negados e inexistentes.
- Testes garantindo que guia e futura coluna resolvem o mesmo componente/id.
- Testes de estados carregando, vazio, erro e dados reais.
- Cobertura de 100% na fatia migrada e preservação da cobertura integral do backend.
- Lint, typecheck e build obrigatórios.
- Comparação visual das telas migradas com as páginas de referência, sem considerar o 1C concluído enquanto a composição permanecer materialmente diferente.

## Fora deste bloco

- Ativar produção ou serviços cloud.
- Remover contas demo.
- Limpar Docker.
- Criar pacotes compartilhados entre repositórios antes do gate do HUB.
- Trocar imediatamente todas as guias por colunas; primeiro será garantida a implementação única.

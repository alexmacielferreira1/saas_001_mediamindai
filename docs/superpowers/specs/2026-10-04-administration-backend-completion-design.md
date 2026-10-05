# Conclusão do backend da Administração

**Data:** 04/10/2026

**Produto:** MediaMind AI (`001_mediamindai`)

**Estado:** especificação para revisão

## 1. Objetivo

Conectar a Administração atual a um backend real, preservando o layout e os fluxos visuais já aprovados. O trabalho deve retirar dados demonstrativos silenciosos das telas autenticadas e tornar persistentes, isoladas por tenant, auditáveis e testáveis as áreas que ainda são apenas prévias.

O resultado esperado é uma Administração funcional de ponta a ponta para usuários, estrutura organizacional, formulários, importações, catálogos de acesso, segurança, integrações e indicadores. Ajustes posteriores de composição por perfil continuarão possíveis sem exigir nova arquitetura de dados.

## 2. Situação atual confirmada

Já estão conectados e cobertos pelo backend:

- usuários administrativos: listagem, detalhe e suspensão;
- grupos de permissão, papéis e telas vinculados à associação do usuário;
- configurações do tenant;
- trilha de auditoria baseada em registros do tenant;
- autenticação, seleção de tenant e verificação de permissões;
- ponte administrativa do HUB.

Ainda usam dados locais, prévias ou implementação parcial:

- equipes, setores e unidades;
- convites e acessos temporários;
- formulários, campos, publicação e respostas;
- importações, mapeamento, validação, execução e relatório;
- catálogo administrativo de módulos, telas e ações;
- política de MFA e credenciais MFA;
- gestão de sessões ativas;
- tentativas de login e histórico de segurança;
- cadastro e monitoramento de integrações;
- indicadores consolidados da visão geral administrativa.

## 3. Princípios e limites

1. **O layout atual permanece.** A entrega troca fontes de dados e completa comportamentos; não redesenha a Administração.
2. **Tenant é a fronteira obrigatória.** Toda leitura e mutação administrativa deve filtrar pelo tenant selecionado na sessão.
3. **Permissão no servidor.** Ocultar um botão não substitui autorização de API.
4. **Auditoria para ações relevantes.** Criações, alterações, exclusões lógicas, importações, mudanças de acesso e ações de segurança geram evento auditável.
5. **Falha explícita.** Em modo autenticado, indisponibilidade do backend não pode ser mascarada por dados demonstrativos.
6. **Dados estruturais em tabelas relacionais.** JSON será reservado a schemas flexíveis, payloads de formulário, mapeamentos e metadados.
7. **Exclusão lógica.** Entidades referenciadas são desativadas ou arquivadas; não são removidas fisicamente em fluxos comuns.
8. **Produção protegida.** Esta especificação não autoriza deploy, migração em Neon ou alteração em Render.
9. **Sem antecipar a Central.** Modelos podem seguir o padrão do HUB, mas banco, domínio e dados do MediaMind continuam independentes.

## 4. Arquitetura proposta

O backend continua no monólito modular existente em FastAPI e SQLAlchemy. Cada domínio administrativo terá modelos, schemas, serviço e router próprios, compartilhando autenticação, tenant, autorização e auditoria existentes.

### 4.1 Organização

Entidades:

- `OrganizationUnit`: unidade organizacional;
- `OrganizationSector`: setor, opcionalmente vinculado a uma unidade;
- `Team`: equipe, vinculada a unidade e/ou setor;
- `TeamMembership`: associação entre usuário e equipe, com função e indicador de coordenação;
- `AdminInvite`: convite com e-mail, perfil pretendido, expiração, estado e token armazenado somente como hash;
- `TemporaryAccess`: janela de acesso temporário atribuída a uma associação do usuário.

Unidade, setor e equipe usam chave única normalizada por tenant e aceitam arquivamento. Uma equipe não pode referenciar unidade ou setor de outro tenant. A remoção de uma unidade com dependências será recusada até reatribuição ou arquivamento em cascata explicitamente solicitado.

### 4.2 Formulários

Entidades:

- `AdminForm`: metadados, estado `draft|published|archived`, entidade de destino e política de acesso;
- `AdminFormField`: ordem, tipo, rótulo, chave estável, validações e configuração;
- `AdminFormVersion`: snapshot imutável do schema a cada publicação;
- `AdminFormResponse`: versão usada, payload, origem, autor opcional e estado.

Respostas sempre apontam para uma versão publicada, evitando que uma edição posterior altere o significado de dados históricos. Campos estruturados usam colunas comuns e configuração JSON validada. O payload da resposta é JSON validado contra o snapshot do formulário.

### 4.3 Importações

Entidades:

- `AdminImportJob`: arquivo, tipo de entidade, estado, autor, contagens e timestamps;
- `AdminImportMapping`: mapeamento de colunas e transformações permitidas;
- `AdminImportIssue`: linha, coluna, severidade, código e mensagem;
- `AdminImportReport`: resumo final e referência ao artefato de relatório.

Fluxo obrigatório:

1. upload do arquivo;
2. leitura segura e amostra;
3. definição ou carregamento do mapeamento;
4. validação integral;
5. confirmação explícita;
6. execução idempotente em transação por lotes;
7. relatório final.

CSV e XLSX serão os formatos iniciais. O arquivo recebe limite configurável de tamanho e quantidade de linhas. Fórmulas não são executadas. A execução exige uma chave de idempotência para impedir duplicação por repetição da requisição.

### 4.4 Catálogo de módulos, telas e ações

Entidades:

- `AdminResource`: árvore tipada (`module|screen|action`) com chave estável, nome, descrição, ordem e metadados;
- `AdminResourcePermission`: vínculo entre recurso e código de permissão existente.

O catálogo descreve a navegação e as capacidades disponíveis, mas a autorização continua baseada em permissões do backend. Chaves usadas em código não podem ser renomeadas diretamente; uma alteração cria nova chave e migra vínculos de forma controlada.

### 4.5 Segurança

Entidades e extensões:

- `SecurityPolicy`: política por tenant para MFA, senha, bloqueio e duração de sessão;
- `MfaCredential`: método TOTP, segredo criptografado, estado e data de confirmação;
- `MfaRecoveryCode`: códigos armazenados como hash e consumidos uma única vez;
- `LoginAttempt`: usuário/e-mail normalizado, resultado, IP protegido, agente, motivo e data;
- `SecurityEvent`: eventos consolidados de autenticação, bloqueio, MFA e sessão;
- extensão de `AuthSession` com nome do dispositivo, IP protegido e revogação administrativa.

Segredos TOTP nunca serão armazenados em texto aberto. A chave de criptografia vem exclusivamente do ambiente e não será versionada. Logs e respostas não expõem tokens, segredos, hashes completos ou IP integral quando a visualização não exigir esse nível de detalhe.

A revogação de uma sessão invalida seu token no servidor. “Encerrar todas” preserva apenas a sessão atual quando essa opção for solicitada explicitamente; o padrão encerra todas, inclusive a atual, e exige novo login.

### 4.6 Integrações

Entidades:

- `AdminIntegration`: tipo, nome, estado, configuração não secreta e referência ao provedor seguro de credenciais;
- `IntegrationObservation`: resultado de verificação, latência, código sanitizado, mensagem e timestamp;

Credenciais não serão retornadas pela API nem persistidas em JSON comum. A primeira entrega suporta cadastro, ativação/desativação, teste sob demanda, histórico de observações e indicadores. Execução periódica será feita pelo mecanismo de jobs já adotado pelo produto; se ele não estiver disponível no ambiente, o teste sob demanda funciona e a tela identifica monitoramento periódico como inativo, sem inventar resultados.

### 4.7 Indicadores administrativos

Um serviço de agregação produzirá os cartões e listas da visão geral a partir das tabelas reais:

- usuários ativos, suspensos e bloqueados;
- convites pendentes e expirando;
- perfis e equipes;
- formulários ativos e respostas no período;
- importações e erros pendentes;
- sessões e tentativas de login;
- alertas administrativos e atividades recentes.

O endpoint aceita período limitado e retorna `generated_at`. Consultas serão agregadas no banco, evitando carregar coleções inteiras na aplicação.

## 5. API

Todos os endpoints ficam sob `/api/v1/admin`, exigem tenant selecionado e retornam erros no formato já usado pela aplicação.

### 5.1 Rotas principais

- `/organization/units`, `/organization/sectors`, `/organization/teams` — CRUD, arquivamento e associações;
- `/invites` — criar, listar, reenviar e cancelar;
- `/temporary-access` — criar, listar e revogar;
- `/forms`, `/forms/{id}/fields`, `/forms/{id}/publish`, `/forms/{id}/responses`;
- `/imports`, `/imports/{id}/sample`, `/mapping`, `/validate`, `/execute`, `/report`;
- `/resources` — árvore de módulos, telas e ações;
- `/security/policy`, `/security/mfa`, `/security/sessions`, `/security/login-attempts`, `/security/events`;
- `/integrations`, `/integrations/{id}/test`, `/integrations/{id}/observations`;
- `/overview` — indicadores consolidados;
- rotas administrativas existentes de usuários, grupos e auditoria permanecem compatíveis.

### 5.2 Convenções

- paginação por cursor ou pelo padrão atual do módulo;
- filtros limitados e validados;
- ordenação somente por campos permitidos;
- `409` para conflito de unicidade ou estado;
- `422` para dados inválidos;
- `403` para permissão insuficiente;
- `404` tanto para recurso inexistente quanto para recurso de outro tenant;
- cabeçalho de idempotência em convites, importações e ações repetíveis de segurança;
- ETag ou versão numérica nos recursos editáveis para impedir sobrescrita silenciosa.

## 6. Permissões

Novos códigos seguem o padrão `<domínio>.<ação>`:

- `admin.organization.view|manage`;
- `admin.invites.view|manage`;
- `admin.forms.view|manage|publish|responses`;
- `admin.imports.view|manage|execute`;
- `admin.resources.view|manage`;
- `admin.security.view|manage|sessions`;
- `admin.integrations.view|manage|test`;
- `admin.overview.view`.

As migrações cadastram os códigos, mas não concedem privilégios indiscriminadamente. O grupo administrativo padrão recebe os acessos conforme a política atual; demais grupos preservam seus vínculos e precisam de concessão explícita.

## 7. Integração com o frontend

O layout e a navegação de `Administration2` serão mantidos. A camada visual será separada de adaptadores de API por domínio:

- hooks de consulta para listas e detalhes;
- mutações com invalidação precisa de cache;
- estados visuais de carregamento, vazio, erro e falta de permissão;
- formulários locais continuam responsivos, mas só exibem sucesso após confirmação do servidor;
- alterações otimistas ficam restritas a ações facilmente reversíveis;
- o modo de demonstração permanece apenas quando iniciado explicitamente como demonstração;
- uma sessão autenticada nunca cai silenciosamente em dados locais.

Os dados ilustrativos podem continuar como fixtures de Storybook/testes e como modo demo explícito, sem participar do fluxo normal.

## 8. Migrações e compatibilidade

As migrações serão pequenas e reversíveis:

1. organização, equipes, convites e acessos temporários;
2. formulários, versões e respostas;
3. importações, problemas e relatórios;
4. catálogo de recursos e permissões;
5. políticas, MFA, tentativas e eventos de segurança;
6. integrações e observações.

Cada migração terá `upgrade` e `downgrade` testados localmente. Alterações em tabelas existentes serão aditivas primeiro. Nenhuma migração de produção será executada nesta fase sem autorização específica e confirmação do alvo Neon.

Dados demonstrativos não serão migrados para o banco. Dados reais já existentes permanecem intactos. Seeds necessários serão determinísticos e restritos a catálogos técnicos e permissões.

## 9. Auditoria, privacidade e segurança

Eventos de auditoria incluem ator, tenant, ação, tipo e id da entidade, resultado, timestamp e diferença sanitizada. Não entram no diff:

- senhas, tokens e segredos;
- conteúdo de códigos de recuperação;
- arquivo de importação completo;
- campos sensíveis de respostas de formulário;
- credenciais de integração.

Uploads usam nome gerado pelo servidor, validação de extensão e conteúdo, diretório controlado e descarte conforme retenção. Consultas e exportações aplicam as mesmas regras de tenant e permissão das telas.

## 10. Tratamento de erros e concorrência

- serviços validam estado antes de escrever;
- operações compostas usam transação;
- publicação de formulário cria uma única versão imutável;
- importações podem ser retomadas apenas antes da execução; uma execução iniciada gera estado próprio e não é repetida;
- conflitos de versão retornam `409` com a versão atual;
- falhas de integrações registram observação sanitizada, sem derrubar a área administrativa;
- revogação de sessão e bloqueio de usuário têm efeito imediato nas verificações subsequentes.

## 11. Estratégia de testes

### Backend

- testes unitários de serviços e regras de estado;
- testes de API para sucesso, validação, permissão e conflito;
- teste de isolamento entre dois tenants em toda família de endpoints;
- testes de auditoria das mutações;
- teste de upgrade e downgrade das migrações;
- importação com arquivo válido, inválido, duplicado, grande e fórmula;
- formulários com versionamento e respostas históricas;
- MFA, bloqueio, revogação de sessão e sanitização de eventos;
- integração com sucesso, timeout e erro sem exposição de segredo.

### Frontend

- testes dos adaptadores e hooks;
- estados de carregamento, vazio, erro e proibição;
- fluxos principais das telas administrativas sem alterar a composição visual;
- confirmação de que modo autenticado não usa fixtures;
- regressão da navegação, usuários e permissões já conectados.

### Verificação integrada

- suíte completa do backend;
- testes direcionados da Administração;
- lint e build do frontend;
- fluxo manual local com dois tenants e perfis distintos;
- verificação visual das páginas existentes em resoluções já suportadas.

## 12. Entrega incremental

A implementação será dividida em blocos verificáveis, cada um com migração, API, ligação da tela e testes:

1. fundação comum, permissões e indicadores-base;
2. organização, equipes, convites e acesso temporário;
3. formulários e respostas;
4. importações;
5. catálogo de módulos, telas e ações;
6. segurança e sessões;
7. integrações e indicadores finais;
8. regressão completa, documentação operacional e preparação de rollout.

Um bloco só é considerado concluído quando não depende de fallback demonstrativo no fluxo autenticado e seus testes passam. Falhas não serão apresentadas como marco aprovado.

## 13. Rollout e rollback

O rollout de produção, quando autorizado, seguirá esta ordem:

1. backup e confirmação do alvo;
2. migrações aditivas;
3. backend compatível com a versão anterior do frontend;
4. frontend conectado;
5. smoke tests e observação de logs;
6. remoção posterior de caminhos obsoletos, em entrega separada.

Rollback de aplicação mantém as tabelas aditivas sem uso. Downgrade de banco só será usado após avaliar perda de dados; por padrão, reverte-se a aplicação e preservam-se os dados coletados. Cada bloco terá comandos e critérios específicos documentados no plano de implementação.

## 14. Critérios de aceite

- todas as áreas administrativas exibidas no layout aprovado consultam dados reais ou indicam explicitamente ausência/configuração pendente;
- operações persistem após recarregar e reaparecem para outro usuário autorizado do mesmo tenant;
- um tenant não lê nem altera dados de outro;
- permissões são aplicadas no servidor;
- mutações críticas aparecem na auditoria sem dados sensíveis;
- formulários preservam versões e respostas históricas;
- importações validam antes de executar e não duplicam por repetição;
- sessões podem ser revogadas e bloqueios têm efeito real;
- credenciais de MFA e integrações não são expostas;
- suíte completa, migrações, lint e build passam;
- nenhuma publicação em GitHub, Render ou Neon ocorre sem autorização explícita para o alvo confirmado.

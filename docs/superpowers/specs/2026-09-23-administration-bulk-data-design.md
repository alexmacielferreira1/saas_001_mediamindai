# Administração e bancada de importação/exportação em massa

**Data:** 23/09/2026  
**Estado:** desenho para revisão  
**Escopo:** MediaMind primeiro, com contratos reaproveitáveis pelos demais SaaS do HUB

## 1. Resultado esperado

Criar uma área de Administração completa sem descartar a tela atual de acessos. A área deve permitir administrar usuários individuais, perfis, funções, permissões, equipes, módulos, formulários, integrações, segurança e configurações. Dentro dela, uma bancada de dados em massa permitirá abrir Excel/CSV, inspecionar e corrigir a tabela, mapear colunas, simular mudanças e somente então importar.

O primeiro corte funcional contempla quatro domínios: usuários, mídias, arquivos e configurações. A segunda leva usa o mesmo motor para pessoas, programas, produções e metadados. A mesma bancada será usada para exportação, respeitando tenant, permissões, filtros e auditoria.

## 2. Restrições e decisões

- A tela existente `AdminAcessosPage` será preservada como guia **Acessos por Função**.
- Pessoa e conta de usuário são entidades relacionadas, mas diferentes.
- Cargo/função não será usado como autorização hardcoded; o acesso efetivo resulta de perfil, função, equipe, escopo e exceções individuais.
- Ver uma tela e executar ações dentro dela são permissões diferentes.
- A importação nunca grava dados antes da validação, da simulação e da confirmação explícita.
- IA pode sugerir mapeamento ou transformação, mas não aplicar silenciosamente.
- O MediaMind recebe a primeira implementação. O contrato horizontal deve poder migrar depois para um serviço compartilhado do HUB sem levar regras audiovisuais específicas.
- O fluxo `Para publicar` continua no desenho separado já aprovado e não será misturado com este pacote.
- Nenhuma alteração será publicada automaticamente no Render; o site atual permanece protegido por testes e homologação.

## 3. Abordagem escolhida

Será usada uma entrega vertical incremental:

1. criar o contêiner de Administração e reorganizar a tela atual;
2. entregar Usuários com lista e detalhe lateral, usando memberships reais;
3. entregar a bancada de dados com adaptador de Usuários de ponta a ponta;
4. acrescentar os adaptadores de Mídias, Arquivos e Configurações;
5. completar as demais guias administrativas em fatias independentes.

Essa abordagem fornece telas utilizáveis cedo, mantém um único motor de importação e evita construir antecipadamente um serviço genérico sem casos reais.

## 4. Navegação e telas

### 4.1 Entrada

A área será acessível pela Gestão e pelo menu do superadministrador. A rota canônica será `/administration`; links existentes para acessos poderão redirecionar para `/administration?tab=access`.

Guias:

1. Visão geral
2. Usuários
3. Acessos por Função
4. Perfis e Funções
5. Permissões
6. Equipes / Setores
7. Telas e Módulos
8. Formulários
9. Importação e Exportação
10. Integrações
11. Segurança
12. Configurações

Auditoria continua sendo a fonte central em Gestão. As telas administrativas mostram apenas atalhos ou recortes filtrados.

### 4.2 Visão geral

Mostra indicadores de usuários ativos, convites, bloqueios, perfis, equipes, formulários e importações, além de pendências acionáveis. Cada cartão abre a guia correspondente já filtrada.

### 4.3 Usuários

Lista pesquisável com filtros por status, função, perfil, equipe, setor e escopo. Ações: convidar, criar, importar, exportar e abrir detalhe.

O detalhe abre no painel lateral em telas largas e em página própria em telas menores. Subguias:

- Visão geral;
- Acessos efetivos;
- Funções e perfis;
- Equipes e escopo;
- Módulos e permissões;
- Segurança;
- Atividade e histórico.

Acesso efetivo deve explicar a origem de cada permissão: padrão do SaaS, tipo de cliente, função, perfil, equipe/setor, usuário ou exceção individual.

### 4.4 Acessos por Função

Reutiliza `AdminAcessosPage` e seu catálogo atual. A tela passa a oferecer editar, duplicar, aplicar aos usuários, ver usuários, histórico e ativar/desativar sem apagar configuração. O configurador por IA permanece como sugestão revisável.

### 4.5 Demais guias

- **Perfis e Funções:** templates, quantidade de usuários, duplicação e histórico.
- **Permissões:** catálogo técnico por módulo e ação.
- **Equipes / Setores:** responsáveis, membros, funções e acesso padrão.
- **Telas e Módulos:** visibilidade separada das ações internas.
- **Formulários:** lista, status, origem e acesso ao construtor futuro.
- **Integrações:** conexões, credenciais por referência, saúde e último uso.
- **Segurança:** MFA, sessões, convites, bloqueios, tokens e expirações.
- **Configurações:** parâmetros administrativos dentro do escopo do tenant.

## 5. Bancada de dados em massa

### 5.1 Objetivo visual

A tela deve se comportar como uma bancada simplificada inspirada no Power Query, sem tentar copiar toda a ferramenta. O usuário enxerga a tabela antes da importação e pode corrigir dados na própria grade.

Layout em três áreas:

- **esquerda:** arquivo, aba/tabela, entidade alvo e etapas aplicadas;
- **centro:** grade editável, cabeçalhos, filtros, seleção, erros e paginação/virtualização;
- **direita:** tipo da coluna, destino, regras, transformação, estatísticas e problemas da seleção.

No topo ficam ações de arquivo, desfazer/refazer, salvar modelo, validar, simular, importar e exportar. Na base fica um resumo fixo de linhas válidas, alteradas, ignoradas, duplicadas e rejeitadas.

### 5.2 Fluxo

`Arquivo → Prévia → Tabela/aba → Mapeamento → Transformações → Validação → Simulação → Confirmação → Job → Resultado/histórico`

O usuário pode voltar às etapas anteriores sem perder a sessão. A confirmação mostra contagens e efeitos esperados antes da escrita.

### 5.3 Fontes e limites iniciais

- CSV UTF-8 e Excel XLSX.
- Tamanho, quantidade de linhas, colunas, abas e tempo de sessão configuráveis.
- Arquivo armazenado temporariamente com checksum, tenant e expiração.
- CSV com detecção e correção explícita de delimitador, cabeçalho e encoding.
- Fórmulas de Excel não serão executadas; será usado o valor armazenado e o usuário será avisado.

### 5.4 Operações da grade

Primeiro corte:

- editar célula;
- renomear, remover e reordenar coluna;
- alterar tipo;
- filtrar e ordenar;
- localizar/substituir;
- preencher vazios;
- dividir coluna por delimitador;
- combinar colunas;
- remover espaços e normalizar caixa;
- marcar linha para ignorar/restaurar;
- desfazer/refazer;
- filtrar somente erros ou duplicidades.

Cada operação vira uma etapa declarativa e reexecutável. A tabela original permanece imutável.

### 5.5 Mapeamento por domínio

O motor recebe um `ImportSchema` versionado. Cada schema declara campos, aliases, tipos, obrigatoriedade, valores permitidos, identidade, regras de atualização e permissões.

- **Usuários:** nome, e-mail, pessoa, status, perfil, função, equipe, escopo e convite. Senhas e secrets nunca entram por planilha.
- **Mídias:** identificador, título, programa, categoria, data, duração, localização, direitos, tags e metadados; não presume upload do master.
- **Arquivos:** referência de storage, nome, MIME, tamanho, checksum, vínculo e classificação. A planilha não concede acesso arbitrário a caminhos locais.
- **Configurações:** chave permitida, escopo, tipo e valor validado. Somente chaves explicitamente importáveis entram no schema.
- **Pessoas:** identidade profissional, contatos autorizados, vínculo e status, sem criar login implicitamente.
- **Programas:** identificação, título, categoria, responsáveis e parâmetros editoriais permitidos.
- **Produções:** programa, episódio, título, estado inicial permitido, responsáveis e datas; não pode saltar etapas protegidas.
- **Metadados:** chave tipada e allowlist por entidade; não altera campos de segurança, auditoria ou sistema.

### 5.6 Validação e simulação

Validações de célula, linha e conjunto incluem obrigatoriedade, tipo, formato, referência, unicidade, escopo, permissão e conflito com dados existentes.

A simulação classifica cada linha como:

- criar;
- atualizar;
- sem alteração;
- ignorar;
- rejeitar.

O usuário pode abrir a diferença antes/depois. O backend recalcula a validação na confirmação; a prévia do navegador não é autoridade.

### 5.7 Execução e resultado

A importação cria job assíncrono idempotente. Escritas são processadas em lotes com resultado por linha; uma linha inválida não torna o relatório opaco. A política do schema define atomicidade total ou parcial.

O resultado informa criadas, atualizadas, inalteradas, ignoradas e rejeitadas. Disponibiliza arquivo de rejeitados, relatório de erros, reprocessamento seguro e auditoria.

### 5.8 Exportação

O usuário escolhe entidade, colunas, filtros, ordem, formato e se inclui metadados técnicos. O backend aplica novamente tenant, escopo, permissão, classificação e LGPD. Exportações grandes são jobs e geram download temporário auditado.

## 6. Arquitetura frontend

Estrutura alinhada ao React/JSX atual:

```text
frontend/src/mediamind/
  pages/Administration.jsx
  components/administration/
    AdministrationOverview.jsx
    AdminUsers.jsx
    AdminUserDetail.jsx
    AdminAccessByRole.jsx
    AdminProfiles.jsx
    AdminPermissions.jsx
    AdminTeams.jsx
    AdminModules.jsx
    AdminForms.jsx
    AdminIntegrations.jsx
    AdminSecurity.jsx
    AdminSettings.jsx
    bulk-data/
      BulkDataWorkbench.jsx
      SourcePanel.jsx
      DataGrid.jsx
      ColumnInspector.jsx
      AppliedSteps.jsx
      MappingPanel.jsx
      ValidationSummary.jsx
      DryRunReview.jsx
      ImportHistory.jsx
  lib/bulkData/
    operations.js
    reducer.js
    validation.js
    schemas.js
frontend/src/api/
  administration.js
  bulkData.js
```

A grade será acessível por teclado, terá edição explícita e virtualização quando o volume exigir. Estado de UI fica separado do estado persistido da sessão.

## 7. Arquitetura backend

Novos módulos serão isolados dos endpoints de identidade existentes:

```text
backend/app/
  api/v1/administration.py
  api/v1/bulk_data.py
  models/administration.py
  models/bulk_data.py
  schemas/administration.py
  schemas/bulk_data.py
  services/bulk_data/
    parsers.py
    registry.py
    transforms.py
    validators.py
    dry_run.py
    executor.py
    exporters.py
```

Entidades mínimas:

- `ImportSession` — fonte temporária, schema, estado, checksum e proprietário;
- `ImportStep` — transformação ordenada e versionada;
- `ImportMapping` — coluna de origem para campo alvo;
- `ImportJob` — confirmação, idempotência, progresso e contagens;
- `ImportRowResult` — resultado e erro por linha;
- `ImportTemplate` — mapeamento/etapas reutilizáveis por escopo;
- `ExportJob` — consulta, filtros, formato, progresso e artefato;
- `AdminProfile`, `AdminTeam` e exceções — somente onde o modelo atual não suprir o contrato.

Estados da sessão: `uploaded`, `previewing`, `mapped`, `validated`, `ready`, `expired`.  
Estados do job: `queued`, `running`, `completed`, `completed_with_errors`, `failed`, `cancelled`.

## 8. APIs principais

- `POST /api/v1/bulk-data/sessions` — cria sessão e recebe arquivo.
- `GET /api/v1/bulk-data/sessions/{id}` — estado e metadados.
- `GET /api/v1/bulk-data/sessions/{id}/preview` — página da grade.
- `PUT /api/v1/bulk-data/sessions/{id}/mapping` — salva mapeamento.
- `PUT /api/v1/bulk-data/sessions/{id}/steps` — substitui receita de transformações.
- `POST /api/v1/bulk-data/sessions/{id}/validate` — valida no backend.
- `POST /api/v1/bulk-data/sessions/{id}/dry-run` — calcula criar/atualizar/rejeitar.
- `POST /api/v1/bulk-data/sessions/{id}/commit` — cria job idempotente.
- `GET /api/v1/bulk-data/jobs/{id}` — progresso e resumo.
- `GET /api/v1/bulk-data/jobs/{id}/rows` — resultado filtrável por linha.
- `POST /api/v1/bulk-data/exports` — cria exportação.
- `GET /api/v1/bulk-data/history` — histórico autorizado.

Endpoints administrativos de usuários, perfis, equipes e permissões usarão os contratos existentes quando possível, em vez de duplicá-los.

## 9. Segurança e auditoria

- Toda sessão e job pertence a tenant e usuário.
- Permissões separadas: visualizar, preparar, validar, simular, importar, exportar, administrar templates e baixar rejeitados.
- Arquivo é validado por tipo real, tamanho e estrutura; nome fornecido pelo usuário não define caminho.
- Fórmulas, macros, links externos e conteúdo ativo não são executados.
- Downloads usam autorização e expiração.
- Logs não registram planilhas inteiras nem dados sensíveis.
- Auditoria registra arquivo/checksum, schema, etapas, contagens, confirmação, executor, exportação e download.
- Importação de usuários não aceita senha, token, segredo ou elevação de superadmin sem fluxo privilegiado específico.
- Exportação aplica minimização, retenção e classificação de dados.

## 10. Tratamento de falhas

- Erro de parsing mantém a sessão com diagnóstico e permite trocar opções de leitura.
- Erros de validação apontam célula, linha, coluna, regra e correção esperada.
- Sessão expirada não pode ser confirmada; o usuário pode reiniciar a partir de template salvo.
- Job interrompido pode retomar a partir de checkpoint quando o schema permitir.
- Repetição da chave idempotente retorna o mesmo job.
- Falha parcial gera relatório completo e não apresenta a importação como totalmente concluída.

## 11. Testes e critérios de aceite

### Frontend

- navegação e permissão das guias;
- detalhe de usuário lateral e explicação do acesso efetivo;
- edição de célula, etapas, desfazer/refazer e filtros de erro;
- mapeamento e resumo de validação;
- bloqueio de confirmação antes da simulação válida;
- estados de carregamento, arquivo inválido, sessão expirada, progresso e resultado parcial;
- acessibilidade de tabela, foco e comandos por teclado.

### Backend

- isolamento por tenant em todas as consultas;
- CSV/XLSX válidos e malformados;
- schemas dos oito domínios;
- transformações determinísticas;
- validação, dry run e diferenças;
- idempotência, retry, cancelamento e expiração;
- permissão por ação;
- arquivo hostil, traversal, conteúdo ativo e limites;
- auditoria e arquivo de rejeitados;
- exportação sem vazamento de campo ou tenant.

### Aceite funcional

1. Um administrador abre XLSX/CSV e vê a tabela antes de qualquer escrita.
2. Pode corrigir células e criar etapas reutilizáveis sem alterar o arquivo original.
3. Vê todos os erros e o efeito criar/atualizar antes de confirmar.
4. Importa usuários, mídias, arquivos, configurações, pessoas, programas, produções ou metadados pelo mesmo fluxo.
5. Recebe resultado por linha e consegue reprocessar rejeitados.
6. Exporta somente dados autorizados, com filtros e histórico.
7. A tela atual de acessos continua funcional dentro da nova Administração.
8. Workspace 1, Workspace 2 e o fluxo de produção não sofrem regressão.

## 12. Decomposição de entrega

1. Contêiner, navegação e Visão geral de Administração.
2. Usuários e detalhe lateral usando dados reais.
3. Acessos por Função reaproveitado sem regressão.
4. Contrato do motor, sessão e parser CSV/XLSX.
5. Grade, operações, mapeamento, validação e dry run.
6. Adaptador de Usuários e execução auditada.
7. Histórico, rejeitados e exportação de Usuários.
8. Adaptadores de Mídias, Arquivos e Configurações.
9. Adaptadores de Pessoas, Programas, Produções e Metadados.
10. Perfis, permissões, equipes, módulos e segurança.
11. Formulários, integrações e configurações restantes.

Cada item será implementado com teste primeiro, verificação completa e commit isolado. Descobertas fora do aceite entram no backlog em vez de ampliar silenciosamente a etapa.

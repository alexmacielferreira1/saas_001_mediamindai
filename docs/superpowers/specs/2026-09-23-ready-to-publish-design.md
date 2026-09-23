# MediaMind — desenho da etapa Para publicar

Data: 23/09/2026  
Estado: aprovado conceitualmente; aguardando revisão desta especificação antes do plano de implementação.

## 1. Objetivo

Criar uma etapa operacional entre a preparação da distribuição e o acompanhamento das publicações. A tela deve conferir versão, arquivo, conteúdo editorial, contas, canais e horários; explicitar bloqueios; exigir autorização; e iniciar a distribuição de forma idempotente e auditável.

Esta etapa não substitui:

- `Finalizado`, que guarda o audiovisual oficial;
- `Redes sociais`, que prepara cortes, formatos e conteúdo;
- o agendamento, que define destino e horário;
- `Publicações`, que acompanha execução, erros, URLs e métricas;
- `Analytics`, que consolida desempenho.

## 2. Fluxo canônico

```text
Finalizado
  → Redes sociais
  → Para publicar
  → Publicações
  → Analytics
```

O estágio principal da produção permanece `finalizado`. A distribuição possui estado próprio. Preparar ou agendar não significa publicar.

Estados da preparação:

- `draft`: configuração ainda incompleta;
- `awaiting_review`: pronta para conferência humana;
- `blocked`: possui impedimentos objetivos;
- `ready`: conferência obrigatória concluída;
- `starting`: requisição de início em processamento;
- `started`: trabalhos de publicação criados; deixa a fila ativa;
- `cancelled`: preparação cancelada com auditoria.

Estados de uma publicação por canal pertencem a `Publicações`: `queued`, `scheduled`, `publishing`, `published`, `failed` e `cancelled`.

## 3. Experiência da tela

A composição segue a referência aprovada:

**Referência visual oficial:** `C:\Users\Alex\Downloads\download.png`
**SHA-256:** `87813C5FA51FF371766BB9BBE201605305905C970B01B16B304FA3104076CEC9`

O desenho deve preservar a densidade operacional da imagem: navegação global no topo, fila compacta à esquerda e detalhe completo à direita, sem transformar o conteúdo em cartões grandes e esparsos. Em desktop, a fila ocupa aproximadamente 40% da largura útil e o detalhe 60%; em viewport estreito, a seleção e o detalhe passam para uma sequência navegável sem ocultar ações.

### Coluna de lista

- título `Para publicar`, descrição curta e botão `Novo agendamento` no mesmo cabeçalho;
- busca por título, programa ou episódio;
- filtros por programa, status, canal e data;
- indicadores para todas, aguardando conferência, conferidas e prontas para iniciar;
- cada card mostra thumbnail, duração, programa, episódio/corte, versão, canais, horário e status;
- seleção abre o detalhe sem sair da tela.

### Painel de detalhe

- cabeçalho com thumbnail/player, título, descrição curta, programa, episódio, corte, versão, formato, duração, responsável e identificador interno;
- guias `Conferência`, `Canais de destino`, `Conteúdo` e `Informações`;
- checklist com progresso e distinção entre verificações automáticas e confirmações humanas;
- canais com conta, destino, horário e prontidão;
- conteúdo editorial com título, descrição, hashtags e thumbnail;
- dados operacionais, última revisão, tentativas e responsável;
- ações contextuais: editar agendamento, abrir mídia, ver produção e duplicar.

Na guia Conferência, checklist e canais ficam lado a lado. Conteúdo editorial e informações operacionais permanecem em blocos compactos abaixo dos canais, conforme a referência, sem exigir navegação para validar o estado básico.

### Rodapé operacional

- mostra os bloqueios antes da tentativa;
- permite concluir conferência somente com itens obrigatórios atendidos;
- habilita `Iniciar publicação` somente no estado `ready` e com permissão;
- mantém `Editar agendamento`, `Abrir mídia`, `Ver produção`, `Duplicar` e menu contextual visíveis no mesmo rodapé;
- durante o início, exibe validação, verificação das contas e criação dos trabalhos;
- após sucesso, informa o estado de cada destino e oferece `Abrir em Publicações`.

Itens iniciados deixam a lista operacional, mas podem ficar disponíveis no filtro `Iniciadas recentemente` por curto período.

## 4. Limites de componentes

O frontend será dividido em unidades pequenas:

- `ReadyToPublishPage`: seleção, filtros e coordenação;
- `PublicationPreparationList`: lista e filtros;
- `PublicationPreparationDetail`: carregamento do agregado selecionado;
- `PublicationChecklist`: verificações e confirmações;
- `PublicationTargets`: contas, canais e horários;
- `PublicationEditorialContent`: copy, hashtags e thumbnail;
- `PublicationOperations`: versão, arquivo e auditoria resumida;
- `StartPublicationButton`: estado, idempotência visual e retorno;
- `publicationPreparationService`: contrato HTTP tipado e normalização de erros.

O estágio será registrado em menu, permissões por perfil e fluxo DnD, sem substituir `CorpPublications`.

## 5. Modelo de dados

Reaproveitar a entidade de agendamento se ela já representar uma preparação multicanal; caso o código atual não possua esse agregado, criar os modelos abaixo. A migration precisa ser aditiva e reversível.

### PublicationSchedule

- `id`, `tenant_id`, `production_id`, `media_asset_id`, `edit_version_id`;
- `title`, `description`, `hashtags`, `thumbnail_asset_id`;
- `status`, `reviewed_by`, `reviewed_at`, `started_by`, `started_at`;
- `created_by`, `created_at`, `updated_at`, `cancelled_at`;
- `version` para controle otimista ou equivalente.

### PublicationScheduleTarget

- `id`, `schedule_id`, `channel`, `channel_account_id`;
- título, descrição, hashtags e thumbnail específicos opcionais;
- `scheduled_at`, `timezone`, `format`, `status`;
- restrição única adequada para impedir destino duplicado na preparação.

### PublicationCheckItem

- `id`, `schedule_id`, `code`, `label`;
- `required`, `automatic`, `completed`;
- `completed_by`, `completed_at`, `details`;
- unicidade por `schedule_id + code`.

### PublicationGroup e Publication

Ao iniciar, criar um grupo e uma publicação por destino. Cada publicação guarda estado, tentativas, último erro, identificador/URL externos, datas e sincronização. O grupo relaciona os destinos originados da mesma preparação.

Todos os registros carregam tenant e obedecem às políticas de isolamento vigentes.

## 6. API

Endpoints sob `/api/v1`:

- `GET /publication-preparations`: lista resumida, paginada e filtrável;
- `GET /publication-preparations/{id}`: agregado único de preparação;
- `PATCH /publication-preparations/{id}`: conteúdo e dados permitidos;
- `PATCH /publication-preparations/{id}/targets/{target_id}`: destino específico;
- `PATCH /publication-preparations/{id}/checks/{check_id}`: confirmação humana;
- `POST /publication-preparations/{id}/complete-review`: conclusão da conferência;
- `POST /publication-preparations/{id}/start`: início idempotente;
- `POST /publication-preparations/{id}/cancel`: cancelamento autorizado;
- `POST /publication-preparations/{id}/duplicate`: cópia sem transportar estados executados.

O detalhe usa uma única resposta agregada para evitar múltiplas chamadas e estados inconsistentes.

## 7. Regras do início

O backend é a autoridade. O frontend antecipa os bloqueios, mas nunca libera por conta própria.

Antes de iniciar:

1. autenticar usuário e resolver tenant;
2. exigir `publication.start`;
3. bloquear preparação diferente de `ready`;
4. bloquear ausência de destinos;
5. revalidar itens obrigatórios, contas, arquivo e versão;
6. bloquear repetição por transação e chave de idempotência;
7. criar `PublicationGroup` e publicações em transação;
8. gravar auditoria;
9. confirmar a transação;
10. enfileirar cada publicação usando identificadores persistidos.

Chamadas a YouTube, Instagram, TikTok ou outros canais não ocorrem dentro da requisição HTTP. O worker processa cada publicação, atualiza estado e preserva erro/retry. Horário futuro gera `scheduled`; ausência de horário futuro gera `queued` e depois `publishing`.

## 8. Permissões

- `publication.view`;
- `publication.schedule.create`;
- `publication.schedule.update`;
- `publication.review`;
- `publication.start`;
- `publication.cancel`;
- `publication.retry`.

Permissões são avaliadas por ação e escopo, não por cargo hardcoded. Social Media pode preparar e revisar sem necessariamente iniciar; coordenação pode iniciar/cancelar; superadmin possui tudo dentro do escopo autorizado.

## 9. Auditoria e confiabilidade

Registrar criação, edição, canal adicionado/removido, checklist marcado/desmarcado, conferência concluída, início solicitado, trabalho criado, programação, tentativa, conclusão, erro, retry e cancelamento.

Cada evento inclui tenant, produto, usuário, entidade, antes/depois quando aplicável, `request_id`, `correlation_id` e metadados sem secrets ou tokens de canal.

Proteções obrigatórias:

- transação com bloqueio apropriado no início;
- chave de idempotência reutilizável em retry incerto;
- concorrência otimista nas edições;
- erro público estável e detalhe interno correlacionado;
- retry limitado e estado de falha persistido;
- nenhuma mensagem de erro contém credenciais ou payload sensível.

## 10. Testes e critérios de aceite

### Domínio/backend

- isolamento entre tenants;
- permissões por ação;
- checklist obrigatório e automático;
- `complete-review` bloqueado com pendências;
- início bloqueado fora de `ready`;
- início duplicado cria apenas um grupo;
- futuro vira `scheduled`; imediato vira `queued`;
- falha de enfileiramento deixa estado recuperável;
- cancelamento e retry auditados;
- migration sobe e desce em banco de teste.

### Frontend

- lista, filtros, seleção e estado vazio;
- detalhe corresponde ao item selecionado;
- checklist reflete resposta do backend;
- bloqueios são exibidos antes do botão;
- botão respeita permissão e estado;
- duplo clique não duplica a ação;
- sucesso remove/move o item e abre `Publicações`;
- responsividade e navegação por teclado;
- comparação visual com a imagem aprovada.

### Regressão

- Finalizados continua funcional;
- Redes sociais mantém as seis etapas;
- Publicações continua acompanhando itens iniciados;
- Analytics continua consumindo publicações concluídas;
- login demo e produção não regridem;
- lint, typecheck, build, cobertura configurada e suíte backend passam.

## 11. Implantação segura

1. introduzir modelos/migration e endpoints sem expor a tela;
2. executar testes com PostgreSQL e dados de tenant;
3. ligar tela sob feature flag local;
4. validar visual e jornada com dados demo;
5. validar integração com `Publicações` sem chamar canais reais;
6. homologar em ambiente não produtivo;
7. publicar somente após checklist e plano de rollback;
8. habilitar adaptadores reais por canal separadamente.

O primeiro release pode simular o worker e persistir estados, desde que a interface deixe claro que nenhum canal externo foi chamado. Não se apresenta simulação como publicação real.

## 12. Fora deste subprojeto

- telas completas de Administração;
- motor Power Query de importação/exportação;
- extração de pacotes compartilhados para todos os SaaS;
- contratação/configuração de APIs reais dos canais;
- redesign de Redes sociais, Publicações ou Analytics além das integrações necessárias.

Esses trabalhos permanecem registrados como subprojetos independentes.

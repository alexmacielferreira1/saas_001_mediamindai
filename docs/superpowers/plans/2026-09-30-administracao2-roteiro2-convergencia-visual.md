# Administração 2 e Roteiro 2 — plano de convergência visual e funcional

**Objetivo:** aproximar as prévias paralelas das 26 referências visuais fornecidas, preservando as telas atuais e conectando cada controle a comportamento real antes de qualquer futura fusão.

**Escopo desta revisão:** `/administration2` e `/roteiro2`. As imagens de Acervo e Gestão orientam a linguagem visual comum, mas a reformulação profunda dessas duas áreas fica para uma etapa posterior solicitada por Alex.

**Regra de convivência:** qualquer tela ou fluxo que possa se confundir com o produto atual permanece identificado como “2” até revisão e aprovação. Nenhuma rota atual será substituída durante estes lotes.

## Diagnóstico executivo

As prévias já provaram navegação, leitura de usuários, grupos/permissões, auditoria, mídia do acervo e persistência básica de roteiros. Porém, ainda estão em um nível de protótipo funcional. As referências apresentam um sistema operacional muito mais denso, hierárquico e específico para administração e produção audiovisual.

As maiores distâncias são:

1. **Arquitetura de informação:** Administração 2 expõe 15 abas em uma faixa horizontal, enquanto as referências trabalham com nove destinos administrativos principais e hierarquia interna. Acervo 2 e Gestão 2 devem ser acessíveis no contexto, mas não competir com as funções administrativas centrais.
2. **Densidade e composição:** as referências usam cabeçalho compacto, cartões baixos, tabelas densas e painéis mestre–detalhe. A implementação atual usa cartões grandes, áreas vazias e blocos genéricos.
3. **Conteúdo específico:** previews com barras cinzas não representam equipes, formulários, importações ou segurança. Cada área precisa reproduzir sua estrutura real, mesmo quando uma ação ainda estiver indisponível.
4. **Roteiro como ferramenta de trabalho:** a tela atual é catálogo + modal. As referências descrevem biblioteca, criação guiada e editor em três colunas com acervo, player, transcrição, seleção IN/OUT e blocos ordenados.
5. **Mídia real:** os cartões de Roteiro 2 ainda usam gradientes e emojis. O alvo exige thumbnails, player autenticado, duração, estado de processamento e metadados reais.
6. **Papéis e escopos:** ainda não está resolvido o que Gestor de Canal/Produção, Gestor do Acervo e demais perfis podem ver e alterar. Essa decisão precisa preceder a ativação de permissões sensíveis.
7. **Estados e confiança:** cada área precisa de loading, vazio, erro, acesso negado, sucesso, conflito e indisponibilidade parcial. Todo elemento com aparência de botão deve funcionar ou aparecer explicitamente desabilitado com motivo.

## Direção visual comum

- Usar como referência-base o shell escuro das imagens, com fundo azul-marinho uniforme, contornos discretos, azul ciano como ação primária e cores semânticas apenas para estado.
- Reduzir raio, altura e espaçamento dos cartões; privilegiar leitura horizontal e densidade de console operacional.
- Remover gradientes decorativos, emojis e cartões genéricos onde houver ícone, thumbnail ou dado real disponível.
- Padronizar tipografia, altura de controles, cabeçalhos de tabela, badges, ícones, foco e estados hover/disabled.
- Adotar largura útil maior em desktop, preservando a lateral do MediaMind; validar em 1366×768, 1600×900 e 1920×1080.
- Em telas menores, transformar faixas largas em navegação por seção e painéis mestre–detalhe em navegação empilhada; não apenas comprimir tabelas.
- O selo “Prévia 2” deve ficar discreto no cabeçalho. Avisos técnicos de fonte de dados não devem dominar a interface final.

## Mapa das referências por tela

| Área | Referências principais | Resultado esperado |
|---|---|---|
| Administração — visão geral | `10_33_42 PM` e composição `10_33_34 PM` | seis indicadores, ações rápidas, alertas, últimas ações e status de segurança |
| Usuários | `10_34_23 PM` | KPIs, filtros completos, tabela densa, convites e acessos expirando |
| Usuário — detalhe/acessos | `10_34_31 PM` e `10_33_34 PM` | cabeçalho do usuário, abas, acessos efetivos, escopo, módulos, segurança e atividade |
| Acessos por função | `10_33_49 PM` | cartões por função, módulos concedidos e pessoas vinculadas |
| Perfis e funções | `10_34_47 PM` | lista mestre, resumo, funções, módulos, matriz e histórico |
| Permissões | `10_33_58 PM` | matriz por módulo/ação, origem da permissão e alterações recentes |
| Equipes/setores/unidades | `10_34_06 PM` | lista mestre, equipe selecionada, membros, funções e vínculos organizacionais |
| Formulários | `10_34_16 PM` | catálogo, editor/preview, campos vinculados, publicação e respostas |
| Importações | `10_34_39 PM` | fluxo upload → mapeamento → validação → importação → relatório |
| Segurança | `10_34_54 PM` e `10_35_00 PM` | KPIs, MFA, bloqueios, sessões, tentativas, expiração e histórico |
| Roteiros — biblioteca | `10_30_46 PM` | continuar edição, modelos, busca/filtros e cards com thumbnails reais |
| Novo roteiro | `10_30_57 PM` | criação guiada por origem, dados iniciais e modelos sugeridos |
| Editor de roteiro | `10_29_50 PM`, `10_31_06 PM`, `10_31_15 PM` | acervo, player/transcrição/trecho e blocos do roteiro em três colunas |
| Seleção de trecho | `10_31_15 PM` e `10_31_06 PM` | player, waveform/filmstrip, IN/OUT, transcrição sincronizada e confirmação |

## Fase 0 — fundação e shell visual

**Estado:** em andamento. A navegação central/relacionada e os primeiros ajustes de densidade já foram aplicados; os tokens e componentes compartilhados continuam pendentes.

- [ ] Criar tokens específicos para superfície, borda, texto, foco, estados, densidade e elevação, reutilizando o tema atual sem uma segunda paleta paralela.
- [ ] Criar componentes densos compartilhados: cabeçalho de página, barra de seção, KPI compacto, toolbar de filtros, tabela, painel mestre–detalhe, timeline, status e estado de tela.
- [ ] Reduzir `mm-panel`, botões e badges para as proporções das referências e eliminar títulos em caixa alta onde prejudicam hierarquia.
- [ ] Definir um shell canônico para Administração 2: lateral global do produto + cabeçalho e barra administrativa de nove destinos.
- [ ] Separar “Acervo 2” e “Gestão 2” da barra administrativa principal; mantê-los na navegação lateral/atalhos de contexto até decidir a fusão.
- [ ] Definir comportamento responsivo e de teclado antes de multiplicar as telas.

**Aceite:** as telas compartilham a mesma grade, espaçamento, hierarquia tipográfica e estados de interação; não há duas linguagens visuais concorrentes.

## Fase 1 — Administração 2: visão geral, usuários e detalhe

**Estado:** em andamento. Links diretos por aba, navegação compacta e indicadores de usuários foram entregues; a reconstrução integral das três telas continua pendente.

- [ ] Reconstruir Visão Geral conforme `10_33_42 PM`, usando apenas métricas reais ou marcadas como indisponíveis.
- [ ] Substituir a grade atual de usuários por toolbar, KPIs, filtros, tabela paginada e painéis de convites/expiração conforme `10_34_23 PM`.
- [ ] Implementar detalhe do usuário como página mestre, não painel improvisado: identidade, dados profissionais, último acesso, validade e ações.
- [ ] Conectar reativação, suspensão, convites, reset de senha e revogação de sessões conforme os endpoints forem entregues.
- [ ] Exibir acessos herdados, exceções, módulos e escopo com explicação da origem de cada permissão.
- [ ] Implementar estados `invited`, `blocked`, `disabled`, `expired` e `deleted` com transições autorizadas e auditoria.

**Aceite:** busca, filtros, paginação, seleção, ações e abas sobrevivem a reload; todas as ações destrutivas têm confirmação e resultado auditável.

## Fase 2 — modelo de acesso: função, perfil, permissão e organização

- [ ] Formalizar separação entre pessoa, usuário, membership, função/cargo, perfil de acesso, equipe e escopo.
- [ ] Implementar Acessos por Função conforme `10_33_49 PM`, sem duplicar grupos de permissão existentes.
- [ ] Implementar Perfis e Funções conforme `10_34_47 PM`, com resumo, módulos, funções associadas, usuários e histórico.
- [ ] Implementar matriz de Permissões conforme `10_33_58 PM`, incluindo permitido, negado, herdado e exceção individual.
- [ ] Implementar Equipes/Setores/Unidades conforme `10_34_06 PM`, com membros e vínculos reais.
- [ ] Registrar módulos, telas, seções, widgets e ações para que a matriz deixe de depender de nomes soltos.
- [ ] Cobrir negação, escalada de privilégio, IDOR e isolamento entre tenants.

### Decisão de produto obrigatória

Antes de ativar mudanças sensíveis, aprovar uma matriz inicial:

| Perfil conceitual | Escopo provável | Questão a decidir |
|---|---|---|
| Superadmin | plataforma/todos os tenants | administração técnica versus operação do cliente |
| Administrador | organização | pode administrar segurança e integrações? |
| Gestor do Acervo | bibliotecas/equipes atribuídas | pode excluir, convidar ou apenas gerir mídia/metadados? |
| Gestor de Canal/Produção | canais/programas/equipes atribuídos | pode aprovar, publicar e ver métricas de outros canais? |
| Editor/Revisor | itens e fluxos atribuídos | quais ações são próprias e quais exigem aprovação? |
| Usuário/Visualizador | leitura limitada | quais bibliotecas, projetos e dados pessoais ficam visíveis? |

## Fase 3 — áreas administrativas especializadas

- [ ] **Formulários:** modelo versionado, campos, vínculo com entidades, publicação, respostas e histórico; visual conforme `10_34_16 PM`.
- [ ] **Importações:** upload, preview, mapeamento, validação, commit idempotente e relatório por linha; visual conforme `10_34_39 PM`.
- [ ] **Segurança:** MFA, política de senha, bloqueios, sessões, tentativas e histórico conforme `10_34_54 PM`/`10_35_00 PM`.
- [ ] **Telas e módulos:** catálogo persistente e navegável, alimentando permissões e auditoria.
- [ ] **Integrações e configurações:** inventário real, estado de conexão, testes de conexão e escopo; não exibir conectores fictícios como ativos.
- [ ] **Cadastros:** definir quais entidades pertencem à Administração e quais pertencem ao domínio de Acervo/Produção antes de criar UI definitiva.

**Aceite:** nenhuma área usa skeleton estático como tela final; uma área sem serviço real informa claramente a indisponibilidade e não simula sucesso.

## Fase 4 — Roteiro 2: biblioteca e criação

**Estado:** em andamento. A biblioteca passou a mostrar preview pelo stream real do acervo; filtros avançados, cards finais e criação guiada continuam pendentes.

- [ ] Reorganizar `/roteiro2` como biblioteca de roteiros conforme `10_30_46 PM`: continuar de onde parou, modelos, filtros, estados, favoritos e pastas.
- [ ] Usar thumbnails e metadados reais do acervo; compartilhar o player autenticado do produto.
- [ ] Criar fluxo “Novo Roteiro 2” conforme `10_30_57 PM`: em branco, a partir de mídia, a partir de pauta e a partir de modelo.
- [ ] Persistir programa, episódio, objetivo, responsável, equipe, duração estimada e observações.
- [ ] Substituir importação JSON exposta como ação principal por importação administrativa/secundária com validação e relatório.
- [ ] Manter rascunho automático, versão e recuperação após conflito ou queda.

**Aceite:** o usuário cria, salva, fecha, reabre, busca e continua um roteiro sem perder estado e sem depender de armazenamento local como fonte de verdade.

## Fase 5 — Roteiro 2: editor audiovisual

- [ ] Construir editor desktop em três colunas: acervo pesquisável, player/transcrição central e blocos ordenados à direita.
- [ ] Implementar busca e filtros de mídia por tipo, data, programa, canal, pessoas, assuntos e status.
- [ ] Implementar seleção de trecho com player, IN/OUT, duração, filmstrip ou waveform e transcrição sincronizada.
- [ ] Criar blocos de texto, vídeo, áudio e mídia de apoio; permitir adicionar, remover, reordenar e trocar mídia.
- [ ] Persistir ordem, conteúdo, referências de asset, timecodes, deixas e observações com controle de versão.
- [ ] Implementar estimativa de duração e alertas de lacuna, mídia indisponível ou trecho inválido.
- [ ] Conectar o fluxo editorial: rascunho → revisão → aprovação → edição, respeitando perfis e auditoria.
- [ ] Integrar com Workspace/Timeline somente após homologação; até lá, manter Roteiro 2 isolado e usar contratos explícitos.

**Aceite:** cada botão visível executa a ação prevista; arrastar/reordenar possui alternativa por teclado; reabrir o roteiro restaura blocos e trechos exatamente.

## Fase 6 — qualidade, acessibilidade e decisão de fusão

- [ ] Criar testes de componente para todos os estados e permissões relevantes.
- [ ] Criar jornadas de navegador para usuário, perfil/permissão, equipe, importação, segurança e roteiro completo.
- [ ] Fazer comparação visual por screenshot nos viewports 1366×768, 1600×900 e 1920×1080.
- [ ] Verificar foco, contraste, nomes acessíveis, navegação por teclado, diálogo, tabela e anúncios de erro/sucesso.
- [ ] Validar carga com listas grandes, paginação e falhas parciais de API.
- [ ] Apresentar Administração 2 e Roteiro 2 para aprovação sem substituir as rotas originais.
- [ ] Somente após aprovação, decidir entre substituir, mesclar ou manter as experiências paralelas, com rollback documentado.

## Ordem prática recomendada

1. Fundação visual e navegação administrativa.
2. Visão Geral, Usuários e Detalhe — maior valor imediato e melhor base de validação.
3. Perfis, Permissões, Acessos por Função e Equipes — resolve a dúvida de quem acessa o quê.
4. Biblioteca e criação de Roteiro 2.
5. Editor audiovisual completo.
6. Formulários, Importações e Segurança.
7. Integrações, configurações, QA final e decisão de fusão.

## O que já existe e deve ser preservado

- Rotas paralelas `/administration2` e `/roteiro2` e seus botões laterais.
- Usuários tenant-scoped, detalhe, suspensão e auditoria inicial.
- Grupos de permissão, usuários vinculados e matriz inicial.
- Leitura do acervo real e persistência básica de registros `Script`.
- Navegação existente de Administração/Acessos, Acervo, Gestão e Workspace.
- Isolamento de tenant, sessão, permissões e padrões de erro já implantados.

## Fora do escopo deste plano

- Substituir imediatamente Administração, Workspace, Acervo ou Gestão atuais.
- Publicar em Render, alterar Neon ou mudar produção.
- Compartilhar banco ou domínio com a Central.
- Exibir números ou integrações fictícias como dados reais.
- Antecipar fusão antes de homologação visual, funcional e de permissões.

## Critérios globais de pronto

- Fidelidade estrutural e de densidade às referências, sem exigir cópia cega de conteúdo fictício.
- Fonte real identificável para todo dado apresentado.
- Nenhum controle decorativo com aparência de ação.
- Estados completos de carregamento, vazio, erro, negação, conflito, sucesso e parcial.
- Permissões explicáveis por origem e escopo.
- Testes, build e lint verdes; navegação manual validada.
- Comparação visual aprovada por Alex antes de qualquer substituição ou fusão.

## GSTACK REVIEW REPORT

| Campo | Resultado |
|---|---|
| `status` | `issues_open` |
| `current_visual_score` | `4/10` — funcionalidade inicial presente, baixa convergência com as referências |
| `target_visual_score` | `9/10` após Fases 0–6 |
| `references_reviewed` | 26 imagens de Administração, Acervo, Gestão e Roteiro |
| `highest_priority` | arquitetura administrativa, usuários/detalhe, matriz de acesso e editor audiovisual |
| `implementation_started` | não; esta entrega é somente revisão e plano |

Decisões em aberto: matriz definitiva de perfis/escopos; shell administrativo canônico; prioridade de responsividade móvel; ordem entre o editor de Roteiro 2 e as áreas administrativas especializadas.

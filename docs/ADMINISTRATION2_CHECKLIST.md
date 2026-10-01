# Administração 2 — checklist de implementação

Atualizado em 30/09/2026. Fonte: `MediaMind_AI_Especificacao_Administracao_e_Roteiro_2.md`, `.docx` e 26 referências visuais fornecidas por Alex.

## Decisão de convivência

- A nova experiência fica paralela em `/administration2` até revisão de Alex.
- A Gestão, a Administração/Acessos existente e o Roteiro atual não são substituídos.
- A execução confirmada no navegador usa `http://127.0.0.1:5174/`; a documentação que cita 5173 está divergente e deve ser reconciliada sem troca forçada de porta.
- Telas repetidas ou potencialmente conflitantes recebem sufixo `2` até avaliação e fusão posterior.
- Roteiro 2 passa a existir isoladamente em `/roteiro2`, sem alterar Workspace 2 ou o roteiro atual.

## Mapa do estado atual

| Área | Tratamento | Estado |
|---|---|---|
| Autenticação, sessão opaca e tenant selecionado | Preservar | Existente e reutilizado |
| Grupos de permissão e vínculos | Conectar | Existentes; usados como perfil/função inicial |
| Administração de Acessos e Telas | Preservar | Incorporada como aba Acessos por Função |
| Gestão, Auditoria e Processamentos | Preservar | Sem alteração estrutural |
| Administração 2 | Adicionar | Rota paralela e navegação própria |
| Usuários e detalhe | Parcial | API tenant-scoped, lista, busca, filtro e detalhe inicial; ciclo completo ainda pendente |
| Ciclo de estado de conta | Completar | Primeiro evento `active → suspended` persistido e auditado |
| Perfis, permissões com escopo e equipes | Parcial | Prévia conectada ao que já existe; modelo relacional completo ainda pendente |
| Telas/módulos, cadastros, integrações e configurações | Estruturar | Prévia navegável, sem persistência própria nem autorização backend |
| Formulários, importações e segurança completa | Parcial | Prévia estrutural; fluxos reais e persistência ainda pendentes |
| Roteiro atual | Preservar | Intocado |
| Roteiro 2 | Adicionar | Primeira prévia visual isolada disponível em `/roteiro2` |

## Lote 1 — base funcional e prévia paralela

- [x] Ler as fontes obrigatórias e as duas versões da especificação.
- [x] Inventariar rotas, componentes, API, modelos, autenticação, permissões e auditoria atuais.
- [x] Criar rota paralela `/administration2` sem substituir telas atuais.
- [x] Adicionar `account_status` com migration reversível.
- [x] Criar `GET /api/v1/admin/users` com tenant, busca, estado e paginação.
- [x] Criar `GET /api/v1/admin/users/{id}` com isolamento por tenant.
- [x] Criar suspensão real, confirmação na UI e evento `user.suspended` append-only.
- [x] Implementar Visão Geral inicial com dados reais disponíveis.
- [x] Implementar lista e detalhe inicial de Usuários.
- [x] Reposicionar a tela existente como Acessos por Função na prévia.
- [x] Aplicar migration e validar a prévia com API/PostgreSQL em execução.
- [x] Incorporar Acervo 2 e Gestão 2 na navegação paralela, preservando as rotas originais.
- [x] Aplicar o sufixo 2 às áreas paralelas para evitar confusão.
- [x] Aproximar Visão Geral, Usuários e detalhe da linguagem visual das referências.
- [x] Criar previews visuais identificadas como não integradas; isso não equivale a funcionalidade concluída.
- [x] Criar `/roteiro2` e botão lateral separado de Workspace 2.
- [x] Conectar o Roteiro 2 ao acervo real do tenant, mantendo criação e edição desabilitadas até existir persistência própria.
- [x] Ativar Novo Roteiro 2, modelos, seleção de mídia, importação JSON e persistência de rascunhos em registro tenant-scoped `Script`.
- [x] Tornar navegáveis as seleções locais das prévias; comandos de gravação continuam indisponíveis até existir backend real.
- [x] Reorganizar a navegação paralela em nove áreas administrativas centrais e seis áreas relacionadas, com aba persistida na URL.
- [x] Acrescentar cabeçalho e indicadores compactos à lista de usuários para aproximá-la da referência visual.
- [x] Conectar Perfis e Funções 2 aos grupos reais, usuários vinculados e permissões do tenant.
- [x] Conectar Permissões 2 à matriz real por grupo e exibir auditoria recente na Visão Geral.
- [x] Carregar até 100 vínculos na Administração 2 para que os indicadores não representem apenas a primeira página.
- [x] Executar suíte backend: 162 testes aprovados.
- [x] Executar testes direcionados frontend: 6 testes do lote aprovados.
- [x] Executar lint, typecheck e build frontend: aprovados (avisos conhecidos de chunk/import dinâmico).
- [x] Reexecutar isoladamente os 3 testes frontend que excederam 5 s na suíte concorrente: 20 testes aprovados.
- [ ] Repetir suíte frontend completa sem concorrência; a execução teve 197 aprovados e 3 timeouts, todos verdes na reexecução isolada.
- [x] Executar smoke com PostgreSQL/API disponíveis.
- [x] Iniciar a convergência visual do Roteiro 2 com biblioteca identificada e preview usando o stream real de vídeo, imagem ou áudio do acervo.
- [x] Substituir os placeholders vazios de Telas e Módulos, Cadastros, Integrações e Configurações por prévias estruturadas e navegáveis.

## Próximo ponto exato

Concluir o detalhe do usuário com reativação e revogação de sessões; em seguida introduzir `Person`, funções múltiplas, perfis e escopos relacionais sem duplicar `Membership`/`PermissionGroup`.

## Evidência e bloqueios da sessão

- `ruff`: aprovado.
- Alembic reconhece `0008_admin_user_status` como head.
- Migration local aplicada após restaurar o PostgreSQL local.
- Validação funcional: `/administration2` carregou 34 usuários do tenant e `/roteiro2` passou a consumir títulos, programa, duração, tipo e estado do acervo real.
- Administração 2, Acervo 2, Gestão 2 e Roteiro 2 continuam como prévias paralelas; nenhuma rota original foi substituída. Prévia visual não significa implementação funcional completa.
- O processo em `5174` foi confirmado como o worktree paralelo `.worktrees/mediamind-mvp`; ele não foi alterado nem encerrado.

## Pendências principais

- [ ] Estados `invited`, `blocked`, `disabled`, `expired` e `deleted`, com transições e auditoria.
- [ ] Convites e reset de senha por token.
- [ ] Person e dados profissionais separados de User.
- [ ] Funções múltiplas, perfis, escopos e exceções individuais explicáveis.
- [ ] Equipes, setores, departamentos e unidades.
- [ ] Registro persistente de módulos, telas, seções, widgets e ações.
- [ ] Formulários versionados e submissões.
- [ ] Importação preview/commit e relatório por linha.
- [ ] MFA, política de segurança, sessões e tentativas recentes.
- [ ] Testes de escalada, IDOR, PostgreSQL e validação visual responsiva.

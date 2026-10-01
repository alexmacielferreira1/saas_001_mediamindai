# MediaMind AI — desenho incremental da primeira versão utilizável

Fonte aprovada pelo usuário: `MediaMind AI - Plano incremental do MVP a partir do ZIP 2026-09-29.md`, anexado à conversa de 29/09/2026.

## Objetivo

Entregar um percurso real e recuperável com conta autenticada, tenant, PostgreSQL e arquivo persistido localmente: perfil de navegação MVP aditivo → gravação/upload → acervo/player → Workspace 2/roteiro/timeline → edição/exportação → Finalizado. O MVP seleciona telas existentes; não substitui a arquitetura, a UI, os perfis, os dados ou o restante do produto.

## Restrições

- O perfil `mvp` é aditivo e não migra vínculos existentes.
- Navegação e segurança são separadas: seleção de telas no frontend não concede permissões na API.
- O percurso MVP não usa Base44, mocks, modo demo ou `localStorage` como fonte compartilhada.
- FastAPI, PostgreSQL e pasta local persistente permanecem a base deste incremento.
- O storage precisa de um contrato substituível por R2 depois, sem implementar R2 agora.
- Compatibilidades Base44 e telas fora do percurso permanecem quando não bloqueiam o MVP.
- Componentes compartilhados podem ser corrigidos, mas devem ser relatados em `Mudanças fora do perfil MVP`.
- Render, Neon e produção não serão alterados.
- O marco `M0 — failed` não pode ser mascarado; gates falhos são registrados nominalmente.

## Arquitetura selecionada

Usar o catálogo `TenantRecord` já existente como persistência inicial, acrescentando tipos de registro específicos para projetos de edição e resultados derivados, em vez de introduzir uma segunda camada ORM prematura. A API de mídia passa a depender de uma interface de storage local e registra origem/vínculos no mesmo `Asset`. O frontend recebe serviços nativos pequenos (`media`, `projects/workflow`) e mantém os componentes visuais atuais.

O perfil `mvp` será um papel reconhecido pelo backend e um perfil de apresentação no frontend com acesso apenas às telas existentes do percurso. As permissões efetivas continuam vindo do grupo atribuído ao vínculo; nenhum seed ou migration altera usuários atuais.

## Fluxos e estados

1. Administrador atribui `mvp` a um vínculo existente quando desejar.
2. Usuário MVP autentica, seleciona tenant e vê apenas Início, Gravações, Acervo, Workspace 2, Edição e Finalizado.
3. Upload cria um `Asset` tenant-scoped, grava o binário pelo contrato de storage e armazena origem/vínculo opcional.
4. Acervo lista `Asset` nativo e o player usa stream autenticado com Range.
5. Workspace 2 salva e atualiza um projeto versionado; roteiro, seleção, tracks, clipes e IN/OUT reabrem em outra sessão.
6. Edição persiste transições válidas e exportação registra um Asset derivado vinculado ao projeto/originais.
7. Finalizado consulta os projetos concluídos e seus resultados derivados; reload e outro usuário autorizado enxergam o mesmo estado.

## Erros e concorrência

Uploads inválidos, excessivos ou interrompidos não deixam registro/binário parcial. Projetos usam versão otimista e retornam conflito explícito quando atualizados sobre versão antiga. Transições inválidas ou sem permissão são negadas pela API. Streams e registros de outro tenant retornam indisponibilidade sem revelar existência.

## Validação

Cada incremento segue teste falhando → implementação mínima → suíte direcionada → suíte completa. A homologação final exige Docker/PostgreSQL ativo, migration aplicada, conta real, dois perfis e vídeo real. Sem esses recursos, a entrega deve declarar precisamente o que ficou automatizado e o que permaneceu bloqueado.

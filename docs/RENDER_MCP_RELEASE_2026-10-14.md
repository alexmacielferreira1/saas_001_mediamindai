# Publicação MCP MediaMind — 14/10/2026

## Escopo e base

Autorização explícita de Alex para atualizar a produção, incluindo a última versão MCP local. Repositório: `alexmacielferreira1/saas_001_mediamindai`. `main` publicado antes desta promoção: `cc6acef27ed3a71d9acc6305cab3d15ba0b08c7a`. A versão candidata é a branch `update/creative-studios-2026-10-11`, que contém o fluxo MCP, o centro MCP, ações de leitura por aplicativo (Word, Excel, PowerPoint e MM tools) e a interface organizada; inclui também a correção do teste OfficeCraft e formatação do registro MCP.

Não incluir alterações locais não commitadas em `frontend/src/App.jsx`, `frontend/src/mediamind/Shell.jsx`, `frontend/src/mediamind/pages/ClipsFree.jsx`, `frontend/src/mediamind/pages/ClipsFree.test.jsx` nem `tmp/supoclip-reference/`; elas permanecem preservadas na árvore local. A publicação é somente do histórico de commits explicitamente integrado à `main`.

## Verificação pré-publicação

Relatório integral `test-results/20261014-001808-181`: backend 240 testes aprovados, cobertura 95,04% (gate configurado em 95%); frontend 514 testes aprovados. Lint, Ruff, formato, typecheck e build passaram. Os 100% de cobertura frontend referem-se somente ao escopo configurado de 9 módulos (211 statements, 144 branches, 57 funções e 186 linhas), não ao frontend inteiro. Permanecem avisos do Browserslist desatualizado, chunk principal de aproximadamente 3 MB e import dinâmico inefetivo; não foram alterados neste release. Nenhum arquivo de migration do produto foi adicionado nesta versão.

## Alvos Render confirmados

- Frontend: `mediamindai-frontend`, `srv-daokabijnfac739ae550`, `main`, root `frontend`, build `npm ci && npm run build`, publish `dist`; auto-deploy desativado, exige deploy manual.
- Backend: `mediamindai-backend`, `srv-daohdu2jnfac73902shg`, `main`; auto-deploy ativo ao atualizar a branch.

## Rollback

Base em produção antes da mudança: `cc6acef27ed3a71d9acc6305cab3d15ba0b08c7a`. Deploys atuais pré-publicação: frontend `dep-db7bb0aj9qps73bpj5l0` e backend `dep-db7b9umi0phs738tpdk0`. Em falha, usar o histórico do Render para reativar o deploy anterior desses serviços; frontend anterior disponível: `dep-db6n507avr4c73ct3vng` (commit `a5de4677cc34e455471770902c5e3051c6188bec`); backend deve voltar ao último deploy saudável baseado em `192289e4df3b405ba8978983315e84bab90f5520`. A versão MCP não traz migrations, portanto o rollback do aplicativo não exige reversão de schema.

Após publicar, confirmar estado `live`, `/health`, `/ready`, frontend público e logs recentes sem iniciar sessão de usuário nem expor credenciais. Este registro não declara aprovados os gates gerais M0–M7 do produto.

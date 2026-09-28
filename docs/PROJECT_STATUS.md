# Estado do projeto

Marco atual: **M0 — failed**.

Verificado em 2026-09-24T00:22:14.471020+00:00.

| Verificação | Estado | Evidência |
|---|---|---|
| backend_lint | failed | Exit 1; evidence: .runtime/checks/backend_lint.log |
| backend_format | failed | Exit 1; evidence: .runtime/checks/backend_format.log |
| unit_tests | passed | Exit 0; evidence: .runtime/checks/unit_tests.log |
| migration | failed | Exit 1; evidence: .runtime/checks/migration.log |
| database_integration | failed | Exit 1; evidence: .runtime/checks/database_integration.log |
| dependency_consistency | passed | Exit 0; evidence: .runtime/checks/dependency_consistency.log |
| frontend_build | passed | Exit 0; evidence: .runtime/checks/frontend_build.log |
| frontend_lint | passed | Exit 0; evidence: .runtime/checks/frontend_lint.log |
| frontend_typecheck | passed | Exit 0; evidence: .runtime/checks/frontend_typecheck.log |
| frontend_unit_tests | failed | Exit 1; evidence: .runtime/checks/frontend_unit_tests.log |
| http_smoke | failed | Exit 1; evidence: .runtime/checks/http_smoke.log |
| original_frontend_integrity | failed | 288 original files; 7 approved typed corrections; 62 unapproved changes or missing. vite.config.js, package-lock.json, package.json, src/App.jsx, src/index.css, src/api/base44Client.js, src/mediamind/data.js, src/mediamind/auth.jsx, src/mediamind/Shell.jsx, src/mediamind/components/IngestNewPackage.jsx, src/mediamind/components/RoteiroEditor.jsx, src/mediamind/components/corp/FinalizadoTimeline.jsx, src/mediamind/components/corp/StageDragList.jsx, src/mediamind/components/corp/RascunhosPage.jsx, src/mediamind/components/corp/SocialCortesWorkspace.jsx, src/mediamind/components/corp/CorpPublications.jsx, src/mediamind/components/corp/RoleInicio.jsx, src/mediamind/components/corp/CorpAnalytics.jsx, src/mediamind/components/corp/GravacoesMateriais.jsx, src/mediamind/components/corp/roles/EdicaoPage.jsx, src/mediamind/components/corp/roles/AdminAcessosPage.jsx, src/mediamind/components/corp/roles/VideomakerPage.jsx, src/mediamind/components/corp/roles/DesignPage.jsx, src/mediamind/components/corp/roles/AgendamentosView.jsx, src/mediamind/components/corp/roles/EditorVideoPage.jsx, src/mediamind/components/corp/roles/CedocPage.jsx, src/mediamind/components/corp/roles/EndomarketingPage.jsx, src/mediamind/components/corp/roles/AprovacoesPage.jsx, src/mediamind/components/corp/roles/EmployeeAccessRow.jsx, src/mediamind/components/corp/roles/CommonScreens.jsx, src/mediamind/components/corp/roles/AprovacaoReviewPanel.jsx, src/mediamind/components/corp/roles/ProdutoraPage.jsx, src/mediamind/components/corp/roles/AssessoriaPage.jsx, src/mediamind/components/corp/roles/AgendamentoDetail.jsx, src/mediamind/components/corp/roles/AudiovisualPage.jsx, src/mediamind/components/corp/roles/RolePageShell.jsx, src/mediamind/components/corp/roles/GestaoPage.jsx, src/mediamind/components/corp/roles/DocumentacaoPage.jsx, src/mediamind/components/corp/roles/RedacaoPage.jsx, src/mediamind/components/corp/roles/RevistasPage.jsx, src/mediamind/components/corp/recortes/ClipPlayer.jsx, src/mediamind/components/corp/recortes/clipModel.js, src/mediamind/components/corp/recortes/ClipCandidatesPanel.jsx, src/mediamind/components/corp/recortes/ClipWorkspace.jsx, src/mediamind/pages/Workspace.jsx, src/mediamind/pages/Home.jsx, src/mediamind/pages/Timeline.jsx, src/mediamind/pages/Login.jsx, src/mediamind/pages/Search.jsx, src/mediamind/pages/ViralClips.jsx, src/mediamind/pages/Corp.jsx, src/mediamind/pages/Management.jsx, src/mediamind/pages/Acervo.jsx, src/mediamind/lib/empresaContext.jsx, src/mediamind/lib/producaoStore.js, src/mediamind/lib/quickActions.js, src/mediamind/lib/mamData.js, src/mediamind/lib/roleCatalog.js, src/mediamind/lib/roleInicioData.js, src/mediamind/lib/roleSubtabs.js, src/mediamind/lib/permissions.js, src/lib/app-params.js |
| frontend_functional_validation | blocked | Original export requires Base44 configuration; frontend not validated in browser. See docs/BASE44_MIGRATION_MAP.md. HTTP/build alone is insufficient. |
| git_clean_at_check | pending | Snapshot before writing this report. Verify and commit reviewed work separately. |

M1–M7 continuam pendentes. Os relatórios não comprovam paridade nem uso em produção.
Não ignorar testes nem desligar verificações. Resolver a causa e executar novamente.

## Validação funcional incremental — 27/09/2026

Sem alterar o marco M0 e sem publicar em produção, foi validado localmente o recorte Timeline 2 + início da esteira. Login demo, mídia real do Acervo, régua/agulha, clique nas faixas, posição de drop, arraste de clipe e transição `Rascunhos → Agendamentos` foram exercitados. A transição permaneceu após reload. Suítes: 51 arquivos/166 testes frontend e 154 testes backend; lint e build aprovados. A validação total segue parcial porque as etapas restantes e a persistência PostgreSQL ponta a ponta ainda não foram homologadas.

## Entrega isolada — contrato de observação do HUB

Implementado localmente, sem publicação e sem avanço de marco: manifesto público e endpoints autenticados de saúde, prontidão e versão para a futura ponte Central ↔ MediaMind. O contrato exige token, audiência e escopo, diferencia liveness de prontidão de banco e não expõe credenciais. A entrega possui testes de contrato próprios; os gates M0 preexistentes continuam valendo integralmente.

Também foi implementado o inbox local idempotente da ponte, restrito aos comandos de leitura `system.describe` e `media.count` em simulação. A migration `0007_hub_commands` foi aplicada ao PostgreSQL local; nenhuma variável ou migration foi aplicada no Render/Neon.

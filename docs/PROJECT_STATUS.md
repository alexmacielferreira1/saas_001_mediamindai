# Estado do projeto

Marco atual: **M0 — blocked**.

Atualizado em 20/09/2026 após a primeira fatia de identidade/tenancy local.

Autenticação, sessão, contas demo protegidas, isolamento básico por membership e seleção de empresa
foram reconstruídos fora do Base44. O layout foi preservado. O gate continua **blocked** porque a
execução PostgreSQL e a navegação ponta a ponta ainda não foram refeitas após essa migração.

Última evidência automatizada: backend **89 passed, 2 skipped**, 100% linhas/branches; frontend
**31 passed**, 100% statements/branches/functions/lines na fatia configurada; lint, format,
typecheck e build aprovados.
Os dois skips exigem PostgreSQL. Em 20/09 o WSL iniciou, porém `com.docker.service` permaneceu
parado e a sessão não tinha permissão para iniciá-lo.

RBAC em andamento: catálogo e grupos por tenant, autorização deny-by-default, CRUD, vínculo com
membership, seed administrativo e listagem local na tela de acessos foram implementados. Overrides
individuais, catálogo funcional completo e prova PostgreSQL da migration `0004_permission_groups`
permanecem pendentes. Alterações de cargo já persistem por membership; CEDOC não pode conceder
`admin/superadmin` sem a permissão separada `users.manage_admin`.

| Verificação | Estado | Evidência |
|---|---|---|
| backend_lint | passed | Exit 0; evidence: .runtime/checks/backend_lint.log |
| backend_format | passed | Exit 0; evidence: .runtime/checks/backend_format.log |
| unit_tests | passed | Exit 0; evidence: .runtime/checks/unit_tests.log |
| migration | passed | Exit 0; evidence: .runtime/checks/migration.log |
| database_integration | passed | Exit 0; evidence: .runtime/checks/database_integration.log |
| dependency_consistency | passed | Exit 0; evidence: .runtime/checks/dependency_consistency.log |
| frontend_build | passed | Exit 0; evidence: .runtime/checks/frontend_build.log |
| frontend_lint | passed | Exit 0; evidence: .runtime/checks/frontend_lint.log |
| frontend_typecheck | passed | Exit 0; evidence: .runtime/checks/frontend_typecheck.log |
| http_smoke | passed | Exit 0; evidence: .runtime/checks/http_smoke.log |
| original_frontend_integrity | passed | 288 original files; 7 approved typed corrections; 0 unapproved changes or missing.  |
| frontend_functional_validation | blocked | Original export requires Base44 configuration; frontend not validated in browser. See docs/BASE44_MIGRATION_MAP.md. HTTP/build alone is insufficient. |
| git_clean_at_check | passed | Snapshot before writing this report. Verify and commit reviewed work separately. |

M1–M7 continuam pendentes. Os relatórios não comprovam paridade nem uso em produção.
Não ignorar testes nem desligar verificações. Resolver a causa e executar novamente.

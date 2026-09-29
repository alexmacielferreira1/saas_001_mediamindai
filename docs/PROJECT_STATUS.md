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

Na continuação do mesmo dia, o Workspace 2 foi validado até o Passo 5: preview funcional no Passo 3, Timeline integrada no Passo 4 e player final/central de exportação no Passo 5. A suíte frontend passou com 53 arquivos/178 testes, lint e build aprovados. A fila permanece local e o marco M0 continua `failed`; esta evidência não representa homologação de produção.

Uma segunda passagem dos PDFs e textos anexados acrescentou rastreabilidade para recursos profissionais ainda ausentes e entregou localmente o primeiro deles: IN/OUT de sequência agora afeta régua, atalhos, player final e render backend. Testes direcionados: 25 frontend e 8 backend aprovados. Isto não altera o marco M0, não torna a fila durável e não equivale a publicação.

Após teste manual do usuário, três bloqueios funcionais permanecem abertos e anulam qualquer alegação de conclusão da jornada: erro da agulha em uso real; player interrompendo/interpretando incorretamente lacunas que deveriam reproduzir preto e silêncio; e falha da transição `aguardando_aprovacao → em_aprovacao`. Eles estão rastreados como `MM-TL-NEEDLE-003`, `MM-PLAYER-GAP-001` e `MM-FLOW-AP-003`. A suíte frontend terminou com 53 arquivos/181 testes aprovados, lint e build aprovados, mas esses testes não substituem a reprodução manual dos três defeitos. O build mantém avisos não bloqueantes já conhecidos.

### Correção funcional local — 28/09/2026

A agulha vertical passou a capturar seu próprio gesto sem movimentar o clipe abaixo; o relógio do preview e do player final continua durante lacunas, exibindo quadro preto até o próximo clipe; e a ação rápida de `Aguardando aprovação` agora executa a transição canônica para `Em aprovação`. Os três caminhos foram cobertos por 14 testes focados e validados no navegador local.

O render backend também passou a preservar a posição temporal dos clipes: lacunas são materializadas como vídeo preto 1280×720/30 fps com áudio silencioso 48 kHz. A integração foi exercitada com o FFmpeg distribuído junto da referência AI Edita; 1 segundo vazio seguido de 1 segundo de mídia produziu MP4 com 2,021 segundos. Assim, `MM-PLAYER-GAP-001` está concluído localmente, sem publicação em produção.

Verificação posterior: suíte completa com 158 testes backend aprovados e 2 testes de integração ignorados pelo ambiente; Ruff e formatação dos arquivos alterados aprovados. O frontend permanece na evidência imediatamente anterior de 186 testes, lint e build aprovados.

A ação real **Exportar sequência** também foi executada na Timeline 2 com o projeto local: o navegador exibiu `Exportação concluída: Jornal-12h---15-05-2026-editado.mp4` e a API registrou `POST /api/v1/media/local/exports/timeline` com status 200. O preview local ficou aberto nessa confirmação.

A duplicidade de navegação `Material para editar`/`Em edição` foi eliminada sem remover estados do fluxo: a navegação agora expõe uma única página `Edição`, enquanto `Para editar`, `Em edição` e `Aguardando aprovação` continuam como filas internas. URLs e permissões antigas são migradas de forma compatível. A URL legada foi exercitada no navegador e abriu a Central de edição unificada. Verificação: 54 arquivos/187 testes frontend, lint e build aprovados. O marco M0 permanece `failed` e nenhuma publicação em produção foi realizada.

A Timeline passou a reproduzir uma sequência temporizada mesmo durante lacunas ou quando a fonte do clipe está temporariamente indisponível, mantendo o preview preto e o relógio contínuo. Keyframes agora usam losango vazado sem ponto e azul preenchido quando ativos. O pacote anexado de legendas foi incorporado como biblioteca de 32 estilos AI Edita mais 4 MediaMind, aplicáveis a clipes de texto e visíveis no preview. O padrão arredondado foi restaurado nas superfícies solicitadas da esteira e publicação. A ordem vertical das trilhas foi desacoplada da ordem interna de composição: textos aparecem no topo, vídeos de maior camada acima dos menores (`V3`, `V2`, `V1`) e áudios abaixo (`A1`, `A2`), inclusive em projetos locais já persistidos. No Passo 2 do Workspace, a pesquisa de mídia agora permanece na coluna esquerda e conserva filtros do Passo 1; ela consulta todo o Acervo, permite selecionar, visualizar, arrastar e adicionar mídias ao roteiro sem sair da página, enquanto a lista de roteiros ocupa a coluna direita. Verificação atual: 55 arquivos/193 testes frontend, lint e build aprovados. Sincronização palavra a palavra e renderização final dos presets continuam pendentes; M0 permanece `failed` e não houve publicação.

Em 29/09, foi reproduzida e corrigida a falha de upload em **Gravações**. A causa era a tela ainda usar o endpoint legado `/uploads`, que exige sessão autenticada no banco, enquanto o modo demo local utiliza o catálogo funcional `/media/local/assets`. Gravações agora usa a mesma API de mídia do Workspace/Timeline tanto no modo local quanto no autenticado, aceita a resposta `stream_url`, preserva `mediaAssetId`, checksum e caminho relativo, vincula o material ao projeto e o mantém disponível no Acervo. O limite exibido foi alinhado à configuração real de 4 GB. Prova real da API: ativo MP4 criado, presente no catálogo e stream parcial respondendo `206`. Verificação: 56 arquivos/195 testes frontend, lint e build aprovados. O Docker estava desligado, portanto a validação foi feita com API/frontend locais sem alterar banco ou volume; M0 continua `failed` e não houve publicação.

## Entrega isolada — contrato de observação do HUB

Implementado localmente, sem publicação e sem avanço de marco: manifesto público e endpoints autenticados de saúde, prontidão e versão para a futura ponte Central ↔ MediaMind. O contrato exige token, audiência e escopo, diferencia liveness de prontidão de banco e não expõe credenciais. A entrega possui testes de contrato próprios; os gates M0 preexistentes continuam valendo integralmente.

Também foi implementado o inbox local idempotente da ponte, restrito aos comandos de leitura `system.describe` e `media.count` em simulação. A migration `0007_hub_commands` foi aplicada ao PostgreSQL local; nenhuma variável ou migration foi aplicada no Render/Neon.

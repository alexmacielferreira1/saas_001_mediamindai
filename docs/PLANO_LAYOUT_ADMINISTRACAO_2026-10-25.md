# Plano — Administração: layout das referências sobre a funcionalidade real

Data: 25/10/2026 · Base: `origin/main` @ 4b22899 · Worktree local: `saas_001_mediamindai-adminlayout` (branch `docs/plano-layout-administracao`, sem commit).
Escopo deste documento: só Administração (`/administration2`). As demais telas entram depois, uma área por vez, com o mesmo método (seção 8).

## 0. O que foi conferido

- **Zip `MediaMind_imagens_e_documentos_2026-10-25.zip`**: a pasta `01_Administracao_29-09` tem 12 imagens (15 a 26). Comparação por hash MD5: **as 12 já estão no repositório** em `docs/referencias/FOTOS_PARA_REVISAO/01_gestao_administracao/` e `docs/referencias/telas/administracao/`. Não há tela nova nem alterada. A matriz `docs/ADMINISTRATION2_VISUAL_AUDIT.md` continua válida. A Fase 0 do rascunho anterior ("subir o zip") deixa de ser necessária para Administração.
- A especificação `MediaMind_AI_Especificacao_Administracao_e_Roteiro_2.md` do zip é a mesma fonte já citada pela auditoria visual.
- As 12 imagens foram vistas uma a uma. O código foi lido na `main` (inventário com arquivo:linha na seção 2).

### Leitura das imagens (o que cada uma exige)

| Img | Tela | Composição | Observação para implementação |
|---|---|---|---|
| 15 | Mapa (mosaico 9 telas) | conferência de cobertura | serve de checklist, não de layout |
| 16 | Visão Geral | 6 KPIs com ícone + "Ver …"; Ações rápidas (5 botões grandes); Alertas administrativos (4 linhas coloridas clicáveis); Últimas ações; Status de segurança (4 linhas com selo) | tendência "+3%" só se houver série histórica real; senão omitir |
| 17 | Acessos por Função | grade 2 colunas de cards por cargo com chips de telas (ativo = azul cheio); busca + filtros + "Nova função" + "Exportar matriz"; rodapé com "Funcionários e acessos por pessoa" e "Configurar acesso por IA" | lógica de `AdminAcessosPage` não muda; muda só a moldura |
| 18 | Permissões | filtros (perfil/módulo/escopo) + chip de filtro ativo; matriz módulo × 7 ações (Permitido/Negado/Herdado); lateral: resumo 27/18/9, Origem das permissões (barras), Permissões críticas; rodapé: Alterações recentes | origem/herdado depende de modelo que ainda não existe → mostrar só "Perfil (direto)" até lá |
| 19 | Equipes/Setores/Unidades | mestre–detalhe: lista de equipes à esquerda; detalhe com 4 mini-KPIs, funções, módulos, membros; lateral Unidades e Setores | precisa backend novo (Team) |
| 20 | Formulários | 4 KPIs; lista com filtros; detalhe com guias (Visão geral/Campos/Publicação/Respostas/Histórico); prévia real do formulário; mapa campo → entidade; publicação; respostas | prévia por tipo (6 tipos) já especificada na auditoria |
| 21 | Usuários (lista) | cabeçalho com 3 ações; 5 KPIs; lateral Convites pendentes + Acessos expirando; 6 filtros + Limpar; tabela com seleção, ordenação, 3 ações por linha, paginação | equipe/setor/unidade/canal = "Não integrado" até existir modelo |
| 22 | Usuário (detalhe) | breadcrumb; ações Editar/Redefinir senha/Suspender/Mais ações; faixa com telefone, cargo, equipe, setor, unidade, último acesso, validade; guias; Acessos efetivos (3 cards); Escopo; Atividade recente (linha do tempo); Módulos; Permissões críticas; Segurança da conta | atividade = auditoria filtrada por `target_user_id`/`user_id` (já existe) |
| 23 | Importação | 4 KPIs; stepper 5 etapas; prévia do arquivo; mapeamento de colunas; resultado da validação com abas Erros/Alertas/Válidas | nada grava antes da confirmação |
| 24 | Perfis e Funções | mestre–detalhe: perfis à esquerda; detalhe com resumo (3 números), funções associadas, módulos liberados (chips), matriz resumida em cards por módulo, histórico do perfil | grupos reais já existem na API |
| 25 | Segurança (detalhada) | 5 KPIs; Política com guias Autenticação/Senha/Sessões/Bloqueios/Convites; MFA por perfil; regras de bloqueio; acessos expirando; sessões; tentativas; histórico | controles complementares |
| 26 | Segurança (operacional) | mesmos blocos, mais densos, KPIs com mini-gráfico | **variante principal**; incorpora as guias da 25 sem duplicar blocos |

Elementos comuns: cabeçalho "Boa tarde / data / empresa" + seletor de área; barra de 9 guias com ícone; cards `rounded` com borda azul fina sobre fundo azul-marinho; chips azuis; selos verde/amarelo/vermelho; botões primário (azul cheio) e secundário (contorno).

## 1. Regras herdadas (não mudam)

1. **Não apagar recurso**: o que não tem lugar na foto vai para subguia `+1`.
2. **Não inventar dado**: número, nome, IP, sessão ou histórico sem fonte real vira `—` ou estado "não integrado". Dados fictícios só no modo demo local, com selo.
3. Botão sem operação real fica desabilitado com motivo (tooltip), nunca "finge" sucesso.
4. Tudo tenant-scoped, autorizado no servidor e auditado; rota nova com teste de acesso cruzado.
5. Workspace2, Roteiros e configuração de IA (outro chat) intocados.
6. Manter `/administration2` paralela até o aceite de Alex; só então trocar a Administração antiga.

## 2. Inventário verificado do código atual

### 2.1 Guias e quem renderiza (`frontend/src/mediamind/pages/Administration2.jsx`)

| Guia (`?tab=`) | Componente | Dados reais | Fixo no código |
|---|---|---|---|
| overview | `Overview` (176) | contagens de usuários por status, perfis, auditoria recente (`LogAuditoria`, 8 itens) | Equipes 7, Formulários 9, Importações 4 (192-194); alerta "1 usuário sem equipe" (220); MFA/Política/Auditoria fixos (229) |
| users | `UsersTab` → `UsersSection` | lista, busca, status, paginação, detalhe, suspender, reativar, encerrar sessões | "Acessos expirando" só texto; coluna Equipe "Não integrado" |
| access | `AdminAcessosPage` | `/memberships`, PUT role e screens (auditados) | liga/desliga de subguias por cargo só no `localStorage` (`lib/roleSubtabs.js`) |
| profiles | `Profiles2` (AccessStructure2.jsx:45) | **nenhum** — não recebe props | perfis, módulos e matriz fixos (11-26) |
| permissions | `Permissions2` (AccessStructure2.jsx:68) | **nenhum** — recebe `groups` e ignora | linhas, 27/18/9, 22/4/1 e histórico fixos |
| teams | `Teams2` | — | 100% demo |
| forms | `Forms2` (UsersForms2.jsx:48) | — | 9 "+28%", 3, 4 "+33%", 126 "+52%", `formsSeed`, "Respostas (243)" |
| imports | `Imports2` | — | 100% demo |
| security | `Security2` | só `users`, dentro de `Math.max` | sessões/IP/cidades, tentativas, histórico, expirações, convites; `Math.max(3,…)` bloqueados, `Math.max(2,…)` convites, "78%", senha "12 caracteres/90 dias"; encerrar sessão/MFA só muda estado local |
| registry / records / integrations | prévias | — | `SCREEN_TREE`, `RECORD_ENTITIES`, `INTEGRATIONS` |
| settings | `SettingsPreview` | GET/PATCH `/admin/settings` (auditado) | demo usa `localStorage` |
| archive / management | telas reais embutidas | reais | — |

**Correção ao rascunho anterior**: Perfis e Permissões **não** usam os grupos reais na tela atual. A versão real está em código morto (`ProfilesTab`, `PermissionsTab`) e a guia mostra `Profiles2`/`Permissions2` com dados fixos. Isso entra na Fase 2 (honestidade).

### 2.2 Dívida estrutural

- `Administration2.jsx`: 596 linhas, 12 linhas com mais de 1000 caracteres (maior 2470). `UsersForms2.jsx` tem linha de 3705 caracteres.
- Alternância "Referência / Versão anterior": só tem efeito em Usuários (`LegacyUsersTab`). Em Perfis, Equipes, Formulários, Importações, Telas e Cadastros está em componentes **nunca renderizados**.
- Código morto: `PermissionsTab`, `ProfilesTab`, `TeamsPreview`, `FormsPreview`, `ImportsPreview`, `SecurityPreview` (usa `SecuritySection` sem import), `Preparing`, `Legacy*` (exceto `LegacyUsersTab`). `Users2` exportado e não usado.
- `GovernanceSections.test.jsx` testa componentes que a tela não mostra.
- Tema: existe Claro/Escuro/Sistema na `main` (`next-themes`, padrão escuro). As classes `slate-*` se adaptam via `palette.cjs`, mas `bg-[#031225]/90` (o `panel` de Security2, Imports2, AccessStructure2, UsersForms2) e sombras `rgba` fixas não se adaptam ao tema claro.

### 2.3 Backend disponível

- `/admin/users`: GET lista, GET detalhe, POST suspend/reactivate/revoke-sessions (permissão `users.manage`, auditados).
- `/admin/settings`: GET (sem `require_permission` — revisar), PATCH (`permissions.manage`, auditado).
- `/memberships`: GET, PUT permission-group/role/screens (auditados).
- `/permission-groups`: GET, **POST, PATCH, DELETE (desativa)** — todos auditados. → "Novo perfil", "Editar" e "Desativar" **já têm endpoint**; o rascunho anterior dizia que não.
- Modelos (`backend/app/models/identity.py`): `AuthSession` sem `ip`/`user_agent`; `User` com `failed_login_attempts` e `locked_until` (bloqueio 5 tentativas/15 min em `core/config.py`); `Membership` sem `access_expires_at`; **não existem** Team, LoginAttempt, Invitation nem MFA.
- Login, logout e bloqueio **não são auditados** hoje (`services/auth.py` não chama `add_audit`).

### 2.4 Testes que protegem o existente

`Administration2.test.jsx` (26 casos), `PeopleAccessSections.test.jsx`, `ContextDetailLayout.test.jsx`, `MediaIdentity.test.jsx`, `AdminAcessosPage.test.jsx` (8), e no backend `test_admin_users_api.py`, `test_permission_groups_api.py`, `test_audit_log_access.py`, `test_auth_api.py`. Sem teste: Security2, Teams2, Forms2, Imports2, Profiles2, Permissions2.

## 3. Fases

### Fase 0 — Linha de base (½ dia)

- [ ] Subir ambiente (skill `mediamind-dev`) e capturar cada guia de `/administration2` em desktop (1440) e estreito (390) → `docs/relatorios/admin-antes/` (local). Essas são as fotos "antes".
- [ ] Rodar `scripts/test-report.ps1` e guardar o resultado como base.
- [ ] Testes de caracterização do que é real e não pode sumir: suspender, reativar, encerrar sessões, trocar papel, telas extras/restritas, copiar acesso, configurações, `?tab=`, modo demo local, estados 401/403. A maioria já existe; completar o que faltar.
- [ ] Revisar `GET /admin/settings` sem permissão explícita (achado de segurança; corrigir com teste se confirmar exposição indevida).

### Fase 1 — Fundação visual e limpeza (1–2 dias, sem mudança de comportamento)

- [ ] Primitivas em `components/admin2/ui/`: `AdminPage` (cabeçalho + breadcrumb + ações), `AdminTabs` (9 guias com ícone), `Panel`, `Kpi` (ícone, valor, legenda, link "Ver …", tendência opcional só com dado real), `MasterDetail`, `DataTable` (ordenação, seleção, paginação; vira cartões abaixo de 768px), `StateView` (carregando/vazio/erro/sem permissão/não integrado/demo), `Chip`, `StatusBadge`, `Toggle`, `Stepper`, `Timeline`.
- [ ] Tokens: substituir `bg-[#031225]/90` e sombras `rgba` por tokens com par claro/escuro (skill `mediamind-tema`). O tema escuro fica visualmente igual.
- [ ] Quebrar `Administration2.jsx`: `pages/admin2/tabs/<Guia>.jsx`; o arquivo principal fica só com rota, carga e guia ativa. Nenhuma linha acima de 200 caracteres.
- [ ] Remover código morto **depois** de conferir item a item contra a tabela 2.1. O que for real e só existir no código morto (ex.: `ProfilesTab`/`PermissionsTab` com grupos reais) é reaproveitado na Fase 3, não descartado. Arquivos removidos vão para `_arquivo/2026-10-2X/`.
- [ ] Alternância "Versão anterior" de Usuários: manter como subguia `Usuários +1` até a Fase 3.3 cobrir tudo que ela tem.

### Fase 2 — Honestidade dos dados (½ dia, antes de qualquer visual novo)

- [ ] Security2: remover `Math.max`, sessões, tentativas, histórico, expirações, "78%" e política fixa. Bloqueados e convites vêm de `users`; o resto mostra `StateView` "não integrado" até a Fase 4. Fictícios só no demo local, com selo.
- [ ] Overview: Equipes/Formulários/Importações = `—` com "não integrado"; alerta "usuário sem equipe" sai; status de segurança mostra só o que existe (auditoria operacional = real, pois `LogAuditoria` existe).
- [ ] Perfis e Permissões: ligar aos grupos reais (`/permission-groups`) já nesta fase, porque hoje mostram dados fixos como se fossem reais.
- [ ] Forms2/Imports2/Teams2: números fixos só no demo; fora dele, `—` + aviso.
- [ ] Testes: para cada guia, "fora do demo nenhum número fixo aparece".

### Fase 3 — Layout das fotos sobre dados reais (4–6 dias, uma guia por PR)

Ordem por valor e risco:

1. **Visão Geral (img 16)** — grade da foto. KPIs e alertas abrem a guia certa com filtro na URL (`?tab=users&status=suspended`). Ações rápidas: "Novo perfil" ativo (endpoint existe); "Novo usuário", "Convidar", "Nova importação", "Novo formulário" desabilitados com motivo até a Fase 4.
2. **Usuários — lista (img 21)** — 5 KPIs (Ativos, Convites, Suspensos, Bloqueados reais; "Acessos hoje" a partir de `AuthSession.last_seen_at` quando a Fase 4.1 entrar), filtros densos (status, perfil reais; equipe/setor/unidade/canal desabilitados), tabela com seleção, ordenação, paginação no servidor e ações em linha; lateral de convites e expirações como `StateView` até existirem.
3. **Usuário — detalhe (img 22)** — faixa de cabeçalho, ações (Suspender/Reativar/Encerrar sessões reais; Editar/Redefinir senha desabilitados até Fase 4), guias no mesmo contexto. **Atividade e Histórico** passam a usar a auditoria filtrada por usuário (dado já existe — exige filtro no backend por `target_user_id`, com teste de tenant). Acessos efetivos: perfil e cargo reais + telas extras/restritas como "exceções individuais" (já existem em `Membership`).
4. **Acessos por Função (img 17)** — moldura de cards em 2 colunas e chips por cargo envolvendo `AdminAcessosPage` sem tocar na lógica; "Configurar acesso por IA" reaproveita `AcessoIAPanel` existente. "Exportar matriz" = CSV gerado no cliente a partir dos dados reais (sem backend novo).
5. **Perfis e Funções (img 24)** — mestre–detalhe com grupos reais; Novo/Editar/Duplicar/Desativar usando `POST/PATCH/DELETE /permission-groups` (já auditados); "Ver usuários" usa memberships; histórico do perfil = auditoria `permission_group.*`.
6. **Permissões (img 18)** — matriz módulo × ação a partir das permissões reais do grupo; resumo efetivas/permitidas/negadas calculado; "Origem" só "Perfil (direto)" até existir herança; alterações recentes da auditoria. Células não clicáveis enquanto não houver mutação por célula.
7. **Segurança (img 26 + guias da 25)** — layout operacional; KPIs reais de bloqueados (`locked_until`) e convites; sessões, tentativas e MFA entram com a Fase 4.
8. **Equipes, Formulários, Importações (imgs 19, 20, 23)** — layout completo da foto com `StateView` "não integrado" e modo demo com selo; funcionalidade vem na Fase 4.

### Fase 4 — Novos recursos (backend + UI, um lote por PR)

Cada lote: migration Alembic reversível, tenant-scope, permissão, evento de auditoria, testes de API (incluindo acesso cruzado) e de UI.

1. **Sessões**: colunas `ip` (mascarado na exibição) e `user_agent` em `AuthSession`, gravadas no login; `GET /admin/users/{id}/sessions`, `GET /admin/security/sessions`, `POST /admin/sessions/{id}/revoke`; auditar login/logout.
2. **Bloqueios e tentativas**: tabela `LoginAttempt` (append-only, retenção configurável, sem senha/token); `POST /admin/users/{id}/unlock`; KPI "tentativas 24h"; histórico de segurança a partir da auditoria.
3. **Política de segurança**: tentativas máximas, tempo de bloqueio e duração de sessão em `admin/settings`, aplicados de fato em `services/auth.py` (hoje vêm de `core/config.py`).
4. **Usuários**: convidar/criar (`Invitation` com token hash e expiração), reenviar/cancelar convite, editar nome/cargo/perfil, `access_expires_at` em `Membership` → alimenta "Acessos expirando" e o alerta da Visão Geral.
5. **Subguias por cargo**: mover o liga/desliga de `roleSubtabs` do `localStorage` para o servidor (hoje some ao trocar de navegador).
6. **Equipes / Setores / Unidades**: `Team`, `TeamMember` (+ setor/unidade) e CRUD; substitui o demo de Teams2 e libera filtros de equipe em Usuários.
7. **Importação de usuários (CSV/XLSX)**: upload → prévia → mapeamento → validação → confirmação, sem gravar antes da confirmação; relatório de erros por linha; modelos de mapeamento salvos.
8. **Formulários**: definição por tipo (6 tipos da auditoria, cada um com campos e entidade próprios), publicação com token e validade, respostas. Maior lote; fica por último.
9. **MFA (TOTP)**: só planejado; projeto separado (política por perfil já desenhada na tela).

### Fase 5 — Aceite (contínuo, por guia)

- Comparação lado a lado foto × captura (desktop e 390px) anexada em `docs/relatorios/`.
- Gates de `ADMINISTRATION2_VISUAL_AUDIT.md`: nenhum dado inventado, nenhum botão ativo sem ação, recursos antigos em `+1`, Workspace2 verde.
- `testador-qa` (links/botões) e `designer-ux` (tema claro/escuro, celular) por guia; `revisor-codigo` + `auditor-seguranca` antes de cada commit.
- E2E Playwright por guia (`scripts/e2e.ps1`).

## 4. Entrega em PRs pequenos

| PR | Conteúdo | Depende de |
|---|---|---|
| 1 | Fase 0: caracterização + correção de `/admin/settings` se confirmada | — |
| 2 | Fase 1: primitivas + tokens + quebra do arquivo + remoção de código morto | 1 |
| 3 | Fase 2: honestidade (inclui Perfis/Permissões ligados aos grupos reais) | 2 |
| 4–10 | Fase 3: uma guia por PR, na ordem 3.1 → 3.8 | 3 |
| 11+ | Fase 4: um lote por PR, na ordem 4.1 → 4.9 | 3 (e a guia correspondente) |

Merge na `main` só por Alex (push na `main` = deploy no Render).

## 5. Decisões (recomendação já aplicada no plano)

- Rota: manter `/administration2` paralela até o aceite; depois substituir a Administração antiga. **Recomendado.**
- Tentativas de login: tabela `LoginAttempt` própria, não a auditoria geral. **Recomendado.**
- Ordem da Fase 4: sessões → bloqueios → política → usuários/convites → subguias no servidor → equipes → importação → formulários → MFA.
- Tendências "+3%" das fotos: só exibir quando houver série histórica real; até lá o KPI aparece sem tendência.

## 6. Riscos

- Arquivo grande com linhas enormes: quebrar antes de mexer no visual (Fase 1) para os diffs ficarem revisáveis.
- Outras worktrees ativas (cobertura, fixfront, tema): conflitos em `Administration2.jsx` são prováveis; sincronizar com a `main` no início de cada PR.
- `AdminAcessosPage` é usada em outros lugares: na Fase 3.4 só envolver, nunca alterar a lógica.

## 7. Estimativa

Fases 0–3: cerca de 7 a 10 dias de trabalho. Fase 4: 1 a 3 dias por lote (Formulários é o maior).

## 7.1 Andamento (25/10/2026, local, sem commit)

**Fase 0 — feita**
- Linha de base backend: 831 testes aprovados (`pytest backend/tests`).
- Capturas "antes" das 9 guias em `docs/relatorios/admin-antes-2026-10-25/` (local, fora do Git). Elas confirmam o problema da Segurança: "78%" e "3 bloqueados" aparecem sob o selo "Dados reais do tenant selecionado".
- `GET /admin/settings` sem permissão: **não é falha**. A rota só devolve nome, idioma, fuso e formato de data da própria empresa, e todo membro precisa desses dados. Isso ficou fixado em teste: membro comum lê só a própria empresa, não altera (403), e outra empresa vê os próprios dados.
- Novos testes de caracterização:
  - Backend: membro sem `users.manage` recebe 403 na lista, no detalhe e ao suspender.
  - Frontend: KPI da Visão Geral abre a guia certa; "Versão anterior" de Usuários filtra no servidor; detalhe com guias reservadas e "voltar"; filtro local no modo demo.
- Correção do inventário: a alternância "Versão anterior" também funciona em **Telas e Módulos** e **Cadastros**. `Preparing` era usado no detalhe antigo do usuário (só o ramo "Área em preparação"). Os dois foram mantidos.

**Fase 1 — feita (sem mudança visual)**
- Token `mm-admin-panel` (escuro `#031225`, claro branco) substitui `bg-[#031225]` nas 4 guias. Conferido no navegador: escuro idêntico, claro branco.
- `components/admin2/ui/`:
  - `styles.js`: painel e botão de contorno, antes repetidos em 4 arquivos.
  - `AdminBlocks.jsx`: AdminTabs, AlertLine, StatusLine, MetricTile, PageLead, PreviewNotice, DemoTable, InfoRow, TagList, EmbeddedArea.
- `Administration2.jsx` caiu de 596 para 155 linhas. As guias foram para `pages/admin2/`: `tabs.js`, `OverviewTab`, `UsersTab`, `CatalogTabs`, `SettingsTab`. Sobram 2 linhas acima de 200 caracteres, ambas classes CSS.
- Código morto removido; cópia em `_arquivo/2026-10-25/` com LEIA-ME. `LegacyProfilesTab` e `PermissionsTab` usavam os grupos reais e serão reaproveitados na Fase 2.
- Primitivas novas (DataTable, MasterDetail, StateView, Stepper) **não** foram criadas agora, para não deixar código sem uso. Entram na fase que as usar. `ContextDetailLayout` já faz o papel de MasterDetail.

**Fase 2 — feita (honestidade dos dados)**
- **Segurança:** só bloqueados e convites saem dos usuários reais. MFA, sessões, tentativas, histórico, validade e políticas aparecem como "não integrado". Chaves e seletores ficam desabilitados com o motivo, e "Reenviar/Cancelar/Renovar" estão desabilitados (antes eram botões mortos). Os `Math.max` saíram. Os dados fictícios só aparecem na sessão local de demonstração.
- **Visão Geral:** Equipes, Formulários e Importações mostram "—" fora do demo. O alerta "1 usuário sem equipe" virou "Vínculo com equipes ainda não integrado". MFA, sessões e senha aparecem como "Não integrado". A auditoria mostra "Operacional" só quando o feed de auditoria carregou; se falhar, mostra "Não verificada".
- **Perfis e Funções:** lista, busca, resumo, funções (cargos dos usuários vinculados), módulos e matriz montados a partir de `GET /permission-groups`. "Ver usuários" lista os vinculados de verdade. "Novo/Editar/Duplicar" ficam desabilitados até a Fase 3, que vai usar os endpoints já existentes.
- **Permissões:** a matriz módulo × ação vem dos códigos reais (Permitido/Negado/—), com filtros de perfil, módulo e busca funcionando. As permissões críticas (manage/delete/approve) vêm do catálogo real. Origem: só "Perfil (direto)"; Função e Exceção aparecem como não integradas.
- 7 testes novos de honestidade (real × demo) em `Administration2.test.jsx`.

**Fase 3.1 — Visão Geral no layout da imagem 16 (27/10/2026)**
- **Indicadores:** seis cards com ícone, valor e link "Ver … →". Equipes, Formulários e Importações mostram "—" e "Não integrado".
- **Filtro pela URL:** os indicadores e os alertas abrem a guia certa já filtrada (ex.: `?tab=users&status=blocked`). Ao clicar na guia Usuários, o filtro volta para "todos".
- **Ações rápidas:** blocos com ícone numa grade que se ajusta à largura disponível, então o texto não quebra mais com o Copiloto aberto. "Novo perfil" abre Perfis. "Novo usuário", "Convidar usuário", "Nova importação" e "Novo formulário" ficam desabilitados com "Requer backend" até a Fase 4.
- **Alertas administrativos:** linhas coloridas com ícone e seta, todas clicáveis.
- **Últimas ações:** mostram quem fez (nome real resolvido pelo `user_id`; sem correspondência, aparece "Sistema"), a ação em português e o tempo relativo. "Ver histórico" abre Gestão.
- **Status de segurança:** cada linha tem ícone, descrição e um selo; o selo é verde só quando o valor é real.
- **Removido:** o título "Administração" que aparecia repetido dentro da Visão Geral.
- **Conferido no navegador:** tema escuro, tema claro (cards brancos) e celular. Capturas em `docs/relatorios/admin-fase3-2026-10-27/`.
- **Testes:** 4 cenários novos de página e 2 testes unitários (`timeAgo` e `auditLabel`).

**Ajustes da revisão de código (27/10/2026)**
- Sem sessão real (403 ou indisponível), a Visão Geral mostra "—" e "Não verificado" em vez de zeros e alertas verdes.
- Perfis e Permissões dizem "indisponíveis" quando os grupos não carregam, em vez de "nenhum".
- "Novo perfil" fica desabilitado com sessão real; nos modos sem sessão vira "Ver perfis".
- Segurança, fora do demo: os botões que só abririam "não integrado" (MFA, sessões, logs, histórico, auditoria, políticas de senha e sessões) ficam desabilitados com o motivo.
- "Usuários ativos" conta só os ativos.
- `?status=` desconhecido na URL é ignorado.
- "Ver histórico" abre Gestão › Auditoria.
- Data inválida aparece como "horário não informado".

**Achado de layout (shell, fora da Administração):** no celular, o painel "Copiloto IA + MCP" ocupa metade da tela e empurra o conteúdo para o lado. Isso é do Shell/MCP, não desta tela.

**Achado de layout:** com o painel "Copiloto IA + MCP" aberto, a Administração fica com cerca de 60% da largura. Os botões de Ações rápidas quebram o texto ("Novo usuário" em duas linhas). Considerar na Fase 3 (grade responsiva ao espaço disponível).

## 8. Expansão para as demais telas (depois de Administração)

Mesmo método por área: (1) conferir as referências de `docs/referencias/README.md` e do zip; (2) inventário real × fixo; (3) honestidade; (4) layout com as primitivas de `admin2/ui` (promovidas para `components/ui-mm/` quando a segunda área usar); (5) recursos novos. Ordem sugerida pelas referências do zip: Gestão (4 imagens), Acervo (3 + outras), Redes sociais (10), Ingest (8), Início, Express. Roteiro só com pedido explícito (Workspace2 protegido).

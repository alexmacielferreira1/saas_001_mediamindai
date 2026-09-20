# Matriz de validação do frontend

Esta matriz registra o estado após a primeira fatia local de identidade e tenancy. Os testes
automatizados provam os contratos abaixo, mas a validação completa no navegador continua pendente
porque o Docker/PostgreSQL não estava disponível em 20/09/2026.

## Modos existentes

| Capacidade | Modo demo local | Base44 real | Evidência estática | Limitação atual |
|---|---|---|---|---|
| Inicialização da aplicação | Restaura a sessão local por cookie | Não participa mais da jornada migrada | `frontend/src/mediamind/auth.jsx`, `backend/app/api/v1/auth.py` | Validação no navegador ainda pendente |
| Entrada por papel | Valida e-mail e senha no backend local; mantém os atalhos demo | Não participa mais da jornada migrada | `frontend/src/mediamind/auth.jsx`, `frontend/src/mediamind/pages/Login.jsx` | Contas demo precisam ser semeadas no PostgreSQL local |
| Proteção de rotas | Exige sessão opaca válida; identidade não fica em `localStorage` | Não participa mais da jornada migrada | `MmProtectedRoute`, `backend/app/tenancy/context.py` | RBAC completo por recurso ainda será migrado por domínio |
| Seleção de empresa | Lista memberships ativas e persiste a seleção no servidor | Não participa mais da jornada migrada | `frontend/src/mediamind/lib/empresaContext.jsx`, `backend/app/api/v1/tenants.py` | Modo global somente para admin/superadmin; prova visual pendente |
| Dados das telas | Muitas telas renderizam coleções `MOCK_*` e estado local | Entidades e funções usam o SDK Base44 | `frontend/src/mediamind/data.js`, ocorrências inventariadas em `docs/BASE44_MIGRATION_MAP.md` | Aparência e interações locais não comprovam operações reais |
| Backend FastAPI novo | Login, sessão, logout, tenants e troca de tenant integrados | Não participa da fatia migrada | `backend/app/api/v1/` | Demais domínios continuam não migrados |

O login demo agora usa autenticação local real, hash `scrypt`, sessão opaca armazenada somente como
hash no banco, cookie `HttpOnly` e bloqueio temporário contra força bruta. O seed recusa produção.

## Rotas do frontend atual

Todas as rotas abaixo, exceto `/login`, passam por `MmProtectedRoute`. No modo demo, a ausência de
usuário redireciona para `/login`; com usuário local, o fluxo passa por `EmpresaProvider` e
`EmpresaGate`. A fonte desta tabela é `frontend/src/App.jsx`.

| Rota | Tela ou redirecionamento | O que pode ser verificado no demo | O que continua sem comprovação |
|---|---|---|---|
| `/login` | Login MediaMind | Renderização, preenchimento e entrada rápida por papel | Autenticação, senha, convite e sessão Base44 |
| `/` | Início | Navegação e apresentação de dados locais | Dados, filtros e permissões persistidos |
| `/search` | Busca | Interface e resultados de demonstração | Busca indexada, autorização e dados reais |
| `/ingest` | Ingestão | Formulários e estados visuais locais | Upload, validação, persistência e processamento |
| `/workspace` | Workspace | Layout e interações locais | Assets, transcrição, revisão e direitos reais |
| `/workspace/timeline` | Workspace | A mesma tela registrada para o caminho alternativo | Persistência e operações de timeline |
| `/timeline` | Timeline | Layout e dados demonstrativos | Agenda/timeline compartilhada e persistida |
| `/social` | Clipes | Interface e coleções locais | Geração, publicação e integrações sociais |
| `/clips` | Redireciona para `/social` | Redirecionamento | Funcionalidade real de clipes |
| `/publish` | Redireciona para `/social` | Redirecionamento | Publicação real |
| `/acervo` | Acervo | Layout, filtros e dados demonstrativos | Bibliotecas, assets, ACL e busca persistidos |
| `/management` | Gestão | Abas e indicadores locais | Jobs, auditoria, relatórios e métricas reais |
| `/reports` | Redireciona para `/management?tab=reports` | Redirecionamento | Relatórios reais e seus controles de acesso |
| `/corp` | IAcervo Corp | Navegação por papel e componentes locais | Entidades, funções, RBAC e isolamento reais |
| `/assistente` | Assistente IA | Interface e estados locais | Chamada de IA, segredos, limites, custo e auditoria |
| demais caminhos | Página não encontrada | Tratamento visual do caminho inválido | Comportamento hospedado na plataforma |

## Critério do gate M0

Uma verificação futura pode registrar separadamente:

1. aplicar migrations e seed no PostgreSQL local;
2. navegar login, refresh, logout, troca de empresa e acesso negado;
3. repetir com a Central parada para provar independência;
4. conferir console e rede, distinguindo falhas dos módulos ainda não migrados.

Os testes automatizados da fatia migrada estão em 100% de linhas, decisões, funções e instruções.
O gate funcional permanece pendente até os quatro itens acima terem evidência no navegador.

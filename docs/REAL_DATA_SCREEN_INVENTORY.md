# Inventário de telas e fontes de dados do MediaMind AI

Atualizado em 05/10/2026. Este inventário descreve o comportamento executável observado; textos e cartões visuais não comprovam integração.

Estados: `PENDENTE`, `EM_EXECUCAO`, `BLOQUEADO`, `CONCLUIDO`.

| Rota | Componente | Fonte atual | Fonte esperada | Leituras | Escritas | Vazio | Erro | Permissão | Demo | Testes | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | `Home.jsx` | API de dashboard misturada com `useMamData` e KPIs fallback | API real ou demo explícita | Mista | Não | Parcial | Silencioso | Rota protegida | Rótulo fixo | `Home.test.jsx` parcial | EM_EXECUCAO |
| `/search` | `SearchPage` | Entidades via adaptador Base44/backend | API real | Real/mista | Não | Parcial | Parcial | Rota protegida | Sessão demo | Não inventariado | PENDENTE |
| `/ingest` | `Ingest.jsx` | Upload real e cartões estáticos de IA | API real | Mista | Upload real | Parcial | Parcial | Módulo | Parcial | Componentes de ingest | PENDENTE |
| `/workspace` | `Workspace2.jsx` | Acervo real com fallback automático para mocks e `localStorage` | API real; demo apenas explícita | Mista | Local/API | Parcial | Vira demo | Módulo | Não isolado | `Workspace2*.test.jsx` | BLOQUEADO |
| `/timeline` | `Timeline.jsx` | `MOCK_SCRIPTS` e `MOCK_ASSETS` | Backend de projeto/timeline | Demo | Memória | Não | Não | Módulo | Não isolado | Sem cobertura suficiente | PENDENTE |
| `/timeline2` | `Timeline2.jsx` | Projeto e rascunho em `localStorage` | Persistência real de projeto | Local | Local | Parcial | Parcial | Módulo | Não isolado | `Timeline2*.test.jsx` | PENDENTE |
| `/social` | `ViralClips.jsx` | Coleções `MOCK_*` | APIs de publicação e métricas | Demo | Não comprovada | Não | Não | Módulo | Rotulado | Cobertura parcial | PENDENTE |
| `/acervo` | `Acervo.jsx` | Management/assets/logs/memberships com `withDemoFallback` | APIs reais e estados explícitos | Mista | Parcial real | Parcial | Vira demo | Módulo/API | Automático | A criar | EM_EXECUCAO |
| `/management` | `Management.jsx` | Overview e memberships com fallback demo | APIs reais | Mista | Parcial | Parcial | Vira demo | Módulo/API | Automático | Cobertura parcial | PENDENTE |
| `/administration2` | `Administration2.jsx` | Usuários/grupos/config reais com fallback local | APIs reais ou demo explícita | Mista | Parcial real | Parcial | Vira demo | Módulo/API | Automático | `Administration2.test.jsx` | EM_EXECUCAO |
| `/roteiro2` | `Roteiro2.jsx` | Fluxo de roteiro e mídia em migração | APIs reais | Mista | Mista | Parcial | Parcial | Módulo | Parcial | `Roteiro2.test.jsx` | PENDENTE |
| `/corp` | `Corp.jsx` e telas por papel | Grande conjunto `MOCK_*`, seeds automáticos e entidades reais parciais | APIs reais por domínio | Mista | Mista | Parcial | Frequentemente vira mock | Catálogo de módulos | Não isolado | Cobertura ampla, fontes incompletas | BLOQUEADO |
| `/assistente` | `AssistenteIA.jsx` | `/ai/functions/assistente_ia` | Provedor configurado e auditável | Endpoint real | Solicitação real | Não configurado | Explícito | Módulo/API | Recusado no demo | `test_ai_api.py` parcial | PENDENTE |

## Primeira fronteira de migração

Este plano altera somente Home, Administração, monitoramento do Acervo e estado de IA. Workspace, Corp, Social e Timeline permanecem registrados para planos posteriores; não serão declarados funcionais enquanto dependerem de fallback automático, memória local ou coleções estáticas.

## Regra de conclusão

Uma linha só muda para `CONCLUIDO` quando leitura, escrita visível, estado vazio, indisponibilidade, falta de permissão e demo explícita estiverem cobertos por teste. Um botão sem endpoint ou persistência permanece desabilitado e identificado, em vez de simular sucesso.

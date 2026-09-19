# Estratégia de testes do MediaMind AI

Este documento aplica o padrão global `../../_documentacao/standards/17-TESTING-STANDARD.md` ao MediaMind. É um roteiro progressivo; itens futuros não estão implementados nem aprovados.

## Baseline atual

M0 possui 22 casos executados e aprovados na última suíte completa. Eles cobrem liveness, versão, correlação, IDs inválidos, contrato de erros, disponibilidade do banco, cabeçalhos HTTP, referência pública de erro, cálculo dos gates e banco PostgreSQL real. Build e lint do frontend passaram; typecheck ainda possui 57 apontamentos e a validação funcional está bloqueada pela configuração Base44 ausente.

## Cobertura planejada

| Marco | Áreas do MediaMind |
|---|---|
| M1 | autenticação, força bruta, usuários, grupos, permissões, tenant, RLS e auditoria |
| M2 | Admin API, capabilities, readiness, contrato com a Central, timeout e modo independente |
| M3 | ativos, upload, bibliotecas, projetos, workspaces, layouts, ingestão, tarefas e progresso |
| M3–M4 | clips, scripts, publicações, contas sociais, relatórios e buscas salvas |
| M4–M5 | pipeline de IA, Whisper/OCR/visão/LLM, falha parcial, reprocessamento, idempotência e custos |
| M5–M6 | testes de componentes, jornadas E2E, segurança, carga de arquivos e recuperação |

## Cenários críticos futuros

- upload válido, extensão proibida, tamanho máximo, checksum incorreto, duplicidade e interrupção;
- ingestão retomável sem criar dados duplicados;
- tarefa, job e pipeline com sucesso, falha, cancelamento, retry e progresso coerente;
- falha de um provedor de IA sem apagar resultados já confirmados;
- frame sampling e limites para evitar processamento e custo descontrolados;
- usuário sem permissão não acessa ativo, projeto, relatório, publicação ou dados de outro tenant;
- buscas e relatórios respeitam os mesmos filtros de autorização da API;
- publicação e integração social tratam token inválido, timeout, rate limit e resposta parcial;
- erro não vaza arquivo, prompt, token, conteúdo privado ou detalhe interno.

## Organização quando cada área nascer

Testes unitários ficam próximos das regras de domínio em `backend/tests/unit/`. Banco e API ficam em `backend/tests/integration/`; Admin API e Central em `backend/tests/contract/`. Jornadas do navegador ficam em `tests/e2e/`. Fixtures de mídia devem ser pequenas, sintéticas e livres de conteúdo de cliente.

Marcadores previstos: `unit`, `integration`, `contract`, `security` e `slow`. O pipeline de IA, arquivos grandes e integrações reais nunca entram silenciosamente em `test-fast`.

## Critério para adicionar ferramentas

Adicionar `pytest-asyncio` quando surgir código assíncrono testável; `pytest-cov` quando houver módulos de domínio suficientes para medir lacunas; Factory Boy/Faker quando factories reduzirem repetição; Freezegun quando expiração, agendamento ou auditoria dependerem do relógio. No frontend, escolher runner de componentes e E2E somente quando a primeira tela for ligada ao backend novo.

## Referência histórica

A pasta antiga tinha 23 arquivos e 440 definições de teste distribuídas pelas áreas acima. Ela foi lida somente para evitar esquecer categorias. Nenhum código ou fixture antigo foi copiado. O inventário está em `../../_documentacao/RELATORIO_REFERENCIA_TESTES_MEDIAMIND.md`.

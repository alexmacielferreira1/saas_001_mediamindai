# Auditoria de cobertura documental — 25/09/2026

## Resultado

As fontes anexadas foram comparadas com a documentação ativa do MediaMind e do HUB. A base existente cobria arquitetura de vídeo, exportação, Edge/CEDOC, RAG, MCP e fine-tuning, mas não havia uma visão única das capacidades do produto. Essa lacuna foi fechada em `03_PRODUCT_CAPABILITY_CATALOG.md`.

Em 25/09/2026, a cobertura foi ampliada para os PDFs integrais `AJUSTAR SAAS 16092026.pdf` (754 páginas) e `Saas atualização 14092026.pdf` (837 páginas). O mapa completo, com classificação e destino, está em `../../../_documentacao/SOURCE_INTAKE_2026-09-25_TWO_MASTER_PDFS.md`. Para o MediaMind, as faixas principais são 114–652 e 681–753 do primeiro PDF e 586–620/688–807 do segundo.

## Cobertura por tema

| Tema das fontes | Documento ativo | Situação |
|---|---|---|
| RAG audiovisual, Knowledge, MCP e fine-tuning | `00_RAG_MCP_FINETUNING_MASTER.md` e `01_IMPLEMENTATION_PLAN.md` | Coberto |
| Benchmark OpusClip sem integração | `DECISIONS.md` e `VIDEO_AI_PROVIDER_STRATEGY.md` | Coberto e decidido |
| Motor próprio de cortes | `03_PRODUCT_CAPABILITY_CATALOG.md`, roadmap e backlog | Coberto |
| Score multidimensional e explicável | `03_PRODUCT_CAPABILITY_CATALOG.md` | Acrescentado |
| Edição por texto, limpeza de fala e editor não destrutivo | `03_PRODUCT_CAPABILITY_CATALOG.md` | Acrescentado |
| Speakers, reframe, tracking, Auto Director e layouts | `03_PRODUCT_CAPABILITY_CATALOG.md` | Acrescentado |
| Legendas nativas e identidade visual | catálogo e `MEDIAMIND_EXPORT_PACKAGE.md` | Consolidado |
| B-roll pelo acervo e direitos | catálogo e plano Knowledge | Acrescentado |
| Pipeline Bronze/Silver/Gold e análise única | catálogo | Acrescentado |
| Jobs, custo, fallback e processamento híbrido | catálogo e `VIDEO_AI_PROVIDER_STRATEGY.md` | Consolidado |
| Exportação NLE, handles, relink e timecode | `MEDIAMIND_EXPORT_PACKAGE.md` | Coberto |
| Edge Agent e processamento on-premises | `EDGE_CEDOC_ARCHITECTURE.md` | Coberto |
| Aprovação, publicação, analytics e feedback | catálogo e backlog | Consolidado |
| Agente local para desenvolvimento | Não é requisito do produto | Mantido fora da arquitetura funcional |
| Preços, limites e recursos atuais de fornecedores | Não incorporados como fatos | Exigem validação oficial futura |
| Regras gerais dos 11 SaaS e Central | Documentação geral do HUB | Direcionado ao plano transversal |

## Materiais não promovidos a requisito

- prompts de execução presentes nos anexos;
- comandos antigos de bootstrap ou caminhos já superados;
- números comerciais e limites de fornecedores sem verificação atual;
- propostas de integração direta com OpusClip;
- recomendações de modelo específico como dependência fixa;
- instruções para apagar, mover ou reconstruir projetos.

## Regra de manutenção

Toda nova ideia funcional deve entrar primeiro no catálogo com estado planejado, depois receber ID no backlog e critérios de aceite. Somente código e testes mudam a capacidade para implementada.

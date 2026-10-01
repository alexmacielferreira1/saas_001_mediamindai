# Requisitos do MediaMind recuperados dos anexos do Codex

Fonte consolidada: `../../_documentacao/CODEX_ATTACHMENTS_REQUIREMENTS_CONSOLIDATED_2026-09-29.md`.
Manifesto: `../../_documentacao/CODEX_ATTACHMENTS_SOURCE_MANIFEST_2026-09-29.md`.

Este documento liga as fontes brutas ao backlog atual. Não substitui `CODEX_BACKLOG.md`, não reabre decisões superadas e não declara implementação.

## Blocos funcionais recuperados

| Bloco | Requisitos centrais | IDs/destinos atuais |
|---|---|---|
| Esteira | ordem canônica, listas por etapa, transições persistentes, histórico | `MM-FLOW-001` e itens `MM-FLOW-*` |
| Acervo/Ingest | upload/pasta, checksum, catálogo, derivados, stream, filtros, metadados e painel lateral | `MM-MVP-JOURNEY-001`, `MM-INGEST-002` |
| ACL por asset | `all`, `all_except`, `only`, enforcement em metadados/original/derivados/stream/download | `MM-ASSET-ACL-001` |
| Workspace/Roteiro | pesquisa, grade/lista, filtros, seleção, drag-and-drop, campos editáveis, blocos e preview | backlog Workspace 2 |
| Timeline | agulha, régua, drag/trim, ripple, snapping, tracks, IN/OUT, gaps, undo/redo e persistência | `MM-TL-*`, `MM-EDITOR-CMDS-001` |
| Áudio/legenda/motion | waveform, mixer, fades, stretch, legendas sincronizadas, keyframes, curvas e máscaras | `MM-EDITOR-AUDIO-001`, `MM-CAPTION-001`, `MM-EDITOR-MOTION-001` |
| Revisão | player compartilhado, timecode, threads, menções, anotações, versões e aprovação | `MM-REVIEW-001`, `MM-PLAYER-SHARED-001` |
| Publicação | Finalizado, Redes sociais, Para publicar, Publicações e Analytics | `MM-PUB-001`, `MM-PUB-002`, `MM-SOCIAL-002`, `MM-ANALYTICS-002` |
| Creative Engine | EditingPlan, Style/Brand Packs, B-roll, edição por texto, render e exportação | `MM-CREATIVE-001` e subitens |
| Clip Engine | transcrição, candidatos, score explicável, IN/OUT, reframe, legenda, render e revisão | `MM-CLIP-ENGINE-001`, `MM-CLIP-MVP-001` |
| Conhecimento/IA | RAG, MCP, feedback, providers, quotas, custos e metadados sugeridos | `MM-RAG-001`, `MM-MCP-*`, `MM-AI-*` |
| Administração | usuários, perfis, permissões, equipes, telas, formulários, integrações e segurança | `MM-ADM-001` |
| Importação | usuários, mídias, arquivos e configurações com PowerQuery simplificado | `MM-IMPORT-001`, `MM-INGEST-ADMIN-001` |

## Decisões preservadas

- O Workspace original não é removido enquanto o Workspace 2 amadurece.
- AI Edita é fonte de funcionalidades e UX, não substituto do MediaMind.
- OpusClip é benchmark; o motor canônico é próprio e usa contratos neutros de providers.
- Sugestão de IA não altera metadado, edição, acesso ou publicação sem revisão conforme risco.
- Regras de acesso são aplicadas no backend, não apenas pela visibilidade do menu.
- Layout e identidade atuais são preservados; a prioridade é completar comportamento e contexto.

## Fontes únicas principais

- `A989B31CA7AE`: ACL por asset, UX por função, revisão colaborativa e ingest administrativo.
- `61AFE90416D5`: ordem da esteira e players funcionais.
- `64B131014810`: fluxo técnico de `Para publicar`.
- `1F0758B9D6DF`, `BD9205C417B4`: agulha e drag da Timeline.
- `2C1B74A17701`, `75A94268C0FF`, `DA5B1A84520C`, `805C7FA69312`: absorção seletiva do AI Edita.
- `AF9F2FEE463B`, `FF10D4667723`: motor nativo de cortes e score.
- `298BE076BAB8`: RAG, MCP, fine-tuning e MediaMind Knowledge.
- `9FC4828E19DA`: custos históricos de fornecedor; somente os modelos de medição foram aproveitados.
- `7ED612BCF473`, `591579DF6B6C`: preservação do produto, autorização backend e remoção progressiva de mocks.

As hashes completas e os caminhos estão no manifesto do HUB.

# Arquitetura da integração AI Edita

## Direção

O MediaMind permanece um MAM, fluxo de newsroom, produção, inteligência de mídia, editor colaborativo, publicação e analytics. A integração não o transforma em clone do AI Edita.

As capacidades editoriais formam o domínio lógico **MediaMind Creative Engine**: projeto e versões; timeline/tracks/comandos; player; captions; animação, gráficos, efeitos e áudio; templates/Brand Kit; EditingPlan/IA; render, derivados e exportação.

## Princípios

- React/Vite e FastAPI/SQLAlchemy/Alembic são preservados.
- PostgreSQL é a fonte de verdade do percurso durável.
- Storage usa contrato substituível; filesystem local é implementação de desenvolvimento.
- FFmpeg é a engine inicial; Remotion pode complementar motion graphics após avaliação.
- Processos pesados usam jobs idempotentes e retomáveis.
- Cortes e Timeline compartilham player, comandos, captions, templates, render e exportação.
- Automação produz comandos editáveis, explicáveis e reversíveis.

## Dados, segurança e auditoria

Antes de criar tabelas, mapear equivalentes para `MediaAsset`, projeto/versão, timeline/track/elemento, marker/comentário, captions, Style Pack, template, Brand Kit, EditingPlan, RenderJob, ExportPreset e preferência.

Rotas frontend não concedem autorização. Editar, aplicar IA, administrar templates/Brand Kit, exportar, aprovar e publicar exigem permissão no backend. Operações relevantes registram ator, origem, antes/depois e correlação.

O armazenamento do navegador serve apenas como recuperação explícita. Projeto, versões, IN/OUT, tracks, captions, markers, jobs e derivados devem sobreviver a nova sessão e respeitar tenant.

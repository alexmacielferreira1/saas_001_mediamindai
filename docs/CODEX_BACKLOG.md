# Backlog do MediaMind AI

Fonte geral: `../../_documentacao/CODEX_BACKLOG.md`.

1. MM-1B: transição compatível das permissões por domínio; depois Ingest resumível/processamento persistente.
2. MM-1C: continuar comparação visual e funcional por fotos, inclusive ações no próprio contexto.
3. MM-1A: migrar testes legados somente quando o comportamento ainda existir; manter cobertura configurada em 100% e ampliar o recorte do Workspace 2.
4. Substituir mocks essenciais e fallbacks de Cortes por APIs persistentes.
5. Completar matriz manual de perfis/tenant/logout e Google OAuth publicado.
6. Atualizar PPT do produto real.

## P0 adicionados em 23/09/2026

- **MM-AI-001 — in_progress:** erro `functions.invoke` removido por adaptador local e endpoint protegido; configurar provider/modelos, schemas por função, quotas, rate limit, auditoria, redaction e testes antes de habilitar IA real.
- **MM-FLOW-001 — in_progress:** aplicar em todos os menus, arrastos, transições e histórico a ordem `rascunho → agendamentos → gravacoes → para_editar → em_edicao → aguardando_aprovacao → em_aprovacao → finalizado → redes_sociais → para_publicar → publicacoes → analytics`, incluindo migração compatível dos estados antigos.
- **MM-PUB-001 — próxima prioridade funcional:** criar `Para publicar` conforme a foto e o texto técnico: lista/detalhe, checklist, canais, conteúdo editorial, bloqueios, revisão e início explícito; o backend deve impedir duplicidade e gerar trabalhos assíncronos.
- **MM-ADM-001 — próximo pacote:** transformar a tela atual em `Acessos por função` e acrescentar Visão geral, Usuários/detalhe, Perfis e Funções, Permissões, Equipes, Telas e Módulos, Formulários, Integrações, Segurança e Configurações seguindo as páginas 19–25 do PDF novo.
- **MM-IMPORT-001 — dependente do contrato HUB-IMPORT-001:** importação/exportação em massa de usuários, mídias, arquivos e configurações, com grade editável no estilo Power Query simplificado, validação, simulação, auditoria e histórico.

## Pacotes derivados do PDF 6

- **MM-AI-VIDEO-001 — P1, pending:** domínio neutro de fornecedor para análise, transcrição, cortes, score, reframe e legendas; resultados reutilizáveis, jobs persistentes, quotas, custos e auditoria.
- **MM-EXPORT-001 — P1, pending:** MediaMind Export Package com Premiere/DaVinci primeiro, legenda editável, frame rate racional, relink, checksums, validação e diferentes modos de mídia.
- **MM-CLIP-ENGINE-001 — P1, pending:** motor próprio de cortes sobre `MM-AI-VIDEO-001`, com candidatos estruturados, score explicável, IN/OUT, revisão humana, legendas, reframe, render, versões, exportação e publicação; OpusClip é somente referência funcional.
- **MM-EDGE-001 — P2, pending:** Edge Agent/CEDOC para manter masters locais e publicar catálogo/derivados autorizados; depende de storage, jobs, segurança e observabilidade estabilizados.

Ordem detalhada: `PDF6_IMPLEMENTATION_ROADMAP.md`. Especificações: `VIDEO_AI_PROVIDER_STRATEGY.md`, `EDGE_CEDOC_ARCHITECTURE.md` e `MEDIAMIND_EXPORT_PACKAGE.md`.

Pronto exige teste automatizado, evidência local/publicada quando aplicável e documentação atualizada.

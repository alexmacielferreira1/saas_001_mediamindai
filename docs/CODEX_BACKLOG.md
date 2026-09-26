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
- **MM-RAG-001 — P1, pending:** busca híbrida multitenant sobre transcrições e chunks com timecode, proveniência, direitos, avaliação e reindexação idempotente.
- **MM-KNOWLEDGE-001 — P2, pending:** ampliar a recuperação para OCR, metadados, pessoas, roteiros, projetos, regras editoriais e documentos autorizados, com retenção por origem.
- **MM-MCP-READ-001 — P2, blocked_by MM-RAG-001 e APIs estáveis:** servidor MCP do MediaMind somente leitura, autenticado, autorizado e auditado.
- **MM-MCP-ACTIONS-001 — P3, blocked_by MM-MCP-READ-001:** ações idempotentes e escopadas; aprovação, exportação e agendamento exigem confirmação humana.
- **MM-AI-FEEDBACK-001 — P2, pending:** eventos append-only de sugestões, decisões e correções, com consentimento, retenção e avaliação offline.
- **MM-FINETUNE-001 — P4, discovery only:** decidir por tarefa especializada somente após dataset real, baseline e ganho mensurável; não usar para memorizar o acervo.
- **MM-CLIP-MVP-001 — P1, blocked_by MM-AI-VIDEO-001:** entregar o primeiro corte vertical real com transcrição, candidatos, score explicável, ajuste IN/OUT, legenda e render, preservando o editor atual.
- **MM-SPEAKER-001 — P2, pending:** diarização, nomes revisáveis e vínculo entre speaker, transcript, busca, legenda e reenquadramento.
- **MM-REFRAME-001 — P2, blocked_by MM-CLIP-MVP-001:** tracking, keyframes, layouts e Auto Director com revisão manual e fallback.
- **MM-TEXT-EDIT-001 — P2, pending:** edição não destrutiva por texto, limpeza de fala revisável, undo e histórico.
- **MM-BROLL-001 — P3, blocked_by MM-KNOWLEDGE-001:** busca e sugestão de B-roll no acervo autorizado antes de fontes externas ou geração.
- **MM-AI-COST-001 — P1, pending:** orçamento, estimativa, quotas, cache, reutilização de análise e bloqueio de cobrança duplicada por tenant/job.

Ordem detalhada: `PDF6_IMPLEMENTATION_ROADMAP.md` e `ai/01_IMPLEMENTATION_PLAN.md`. Catálogo funcional: `ai/03_PRODUCT_CAPABILITY_CATALOG.md`. Especificações: `ai/00_RAG_MCP_FINETUNING_MASTER.md`, `VIDEO_AI_PROVIDER_STRATEGY.md`, `EDGE_CEDOC_ARCHITECTURE.md` e `MEDIAMIND_EXPORT_PACKAGE.md`.

Pronto exige teste automatizado, evidência local/publicada quando aplicável e documentação atualizada.

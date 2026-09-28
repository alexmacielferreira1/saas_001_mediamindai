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
  - Validado em 27/09: ordem canônica, controles anterior/próximo, zona de drop adjacente e persistência local após reload. Ainda falta concluir persistência nativa/API e validar ponta a ponta todas as telas posteriores a `Agendamentos`.
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

## Lista funcional consolidada — inspeção de 27/09/2026

O texto de revisão do usuário foi incorporado como requisito, mas itens só mudam para concluídos com ação real e teste.

| ID | Estado | Erro/requisito | Aceite mínimo |
|---|---|---|---|
| MM-UX-RA-001 | done_local | Rascunhos exibia itens de outras etapas | lista mostra somente `etapa=rascunho`; ao avançar o item desaparece |
| MM-UX-PR-001 | pending | Sugestões de convidados sem nome/cargo predefinidos | sugestões selecionáveis e editáveis, persistidas no programa/agendamento |
| MM-FLOW-GR-001 | pending | Gravações vazia após confirmar agendamento | confirmar gravação cria/atualiza registro visível e auditável |
| MM-INGEST-002 | in_progress | Arquivo ingerido não aparece; ações “puxar para editar”, atribuir e concluir não alteram fluxo | upload local real aparece no Acervo/Gravações e cada ação persiste/transiciona |
| MM-FLOW-ED-002 | **done_local 2026-09-28** | Duplicidade “Material para editar”/“Em edição” e destinos incorretos | menu único `Edição`; filas internas `Para editar`, `Em edição` e `Aguardando aprovação` preservadas; permissões e links antigos `para_editar` migram para `em_edicao`; regressão automatizada e navegador local validados |
| MM-FLOW-AP-002 | in_progress | Aguardando aprovação não chega à revisão; solicitar alteração não volta à Edição | transições reais, item sai da origem e aparece no destino após reload |
| MM-APPROVAL-002 | done_local | Aprovar versão com alterações abertas não pede confirmação | confirmação obrigatória antes de aprovar com pendências |
| MM-PLAYER-001 | in_progress | Players, IN/OUT e marcações inconsistentes entre telas | componente funcional compartilhado em revisão, finalizado, publicação e exportação |
| MM-EXPORT-PLAYER-001 | done_local | Passo 5 não possuía player da versão final | sequência editada tem play/pause, seek, mute, timecode, clipe/texto/áudio ativos |
| MM-PUB-002 | pending | Finalizado → Cortes/Agendar e Para publicação/Publicados com ações/layout incompletos | transições, salvamento, cantos/layout padrão, botões e players funcionais |
| MM-SOCIAL-002 | pending | Adicionar canal não permite escolher/configurar e ícones estão genéricos | seletor de rede/canal, credenciais seguras, formatos e ícones corretos |
| MM-ANALYTICS-002 | pending | Analytics poluído e sem recorte útil | filtros por canal, formato, período e conteúdo com visual progressivo |
| MM-ACERVO-DETAIL-001 | pending | Detalhes do Acervo abrem como janela indesejada | painel lateral editável sem perder contexto da lista |
| MM-ADMIN-002 | pending | Gestão/relatórios/configurações pouco editáveis | telas administrativas reais, inclusive configuração de IA por provedor sem expor secrets |
| MM-BATCH-001 | in_progress | Edição em lote/fila precisava configuração e execução | lote configura legenda/pausas/texto/formato/destino e gera trabalhos processáveis; persistência em banco/worker ainda pendente |
| MM-TL-RANGE-001 | done_local | Faltavam IN/OUT reais da sequência | I/O e botões marcam faixa, régua mostra intervalo, player final limita a prévia e backend recorta o render |
| MM-TL-TRACKS-002 | in_progress | Fontes especificam V1/V2, G1, T1, C1, A1 e M1 | vídeo/áudio/texto existem; criar tipos especializados com regras de empilhamento |
| MM-AUDIO-WAVE-001 | pending | Waveform, mixagem, fade e stretch ausentes | derivados reais, sincronia, controles e render; não usar desenho fictício |
| MM-CAPTION-001 | **in_progress 2026-09-28** | Legendas sincronizadas e style pack de 32 presets ausentes | os 32 presets do pacote `AI-Edita-Legendas-Pro-v2.aiedita` e 4 estilos MediaMind estão selecionáveis, editáveis e visíveis no preview; sincronização palavra a palavra, tradução e queima no render ainda precisam ser concluídas |
| MM-PROCESSOR-001 | pending | Processamento pesado ainda ocorre na requisição local | Media Processor/worker idempotente com progresso, retry, cancelamento e falha explícita |
| MM-JOBS-001 | pending | Fila local não é durável | estados `queued/preparing/rendering/packaging/validating/ready/failed`, banco, worker e auditoria |
| MM-ACERVO-BATCH-001 | pending | Faltam ações em lote e duplicidade por conteúdo | mover/taguear/categorizar/indexar/reprocessar/exportar/baixar/arquivar com checksum/fingerprint |
| MM-EXPORT-PACK-002 | in_progress | Exportação externa ainda não forma pacote profissional validado | perfis Premiere/DaVinci/Final Cut/Avid, handles, sidecars, legendas, checksums, relink e validação |
| MM-PLAYER-SHARED-001 | in_progress | Players permanecem inconsistentes entre módulos | componente compartilhado com seek, IN/OUT, SMPTE, marcadores, comentários e estados reais |
| MM-TL-NEEDLE-003 | **done_local 2026-09-28** | A linha vertical deixava o evento atravessar para o clipe abaixo | agulha ganhou área interativa própria; arraste real no navegador alterou `2s → 3,745s` sem mover o clipe; teste de regressão cobre o gesto |
| MM-PLAYER-GAP-001 | **done_local 2026-09-28** | Player e render eliminavam ou interpretavam incorretamente lacunas da Timeline | preview e player final mantêm relógio contínuo; render intercala MP4 de quadro preto e áudio silencioso. Prova real: 1 s de lacuna + 1 s de mídia gerou arquivo de 2,021 s |
| MM-FLOW-AP-003 | **done_local 2026-09-28** | A fila visual acabava em `aguardando`, embora o cartão mostrasse ação para `em_aprovacao` | transição canônica usa `transicionar`, remove o cartão da origem, aparece no destino e possui regressão automatizada |

Observação de regressão em 28/09: a Timeline agora também mantém o relógio e o quadro preto quando o clipe possui duração mas a fonte está temporariamente indisponível, sem exigir que a agulha esteja sobre mídia reproduzível. O losango de keyframe fica vazado sem ponto no quadro e azul preenchido quando existe keyframe. Agendamentos, Gravações, Edição, Aprovação, Finalizado, Para publicação, Publicado e Analytics receberam o padrão arredondado sem reorganização estrutural.

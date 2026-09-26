# Roadmap de implementação dos acréscimos do PDF 6

## Regra de execução

Os itens abaixo são novos pacotes planejados. Eles entram depois dos P0 já ativos e não substituem as tarefas 1A, 1B, 1C, 2, 3, 4 e 5. Cada pacote só muda para concluído com implementação, testes, comparação visual quando houver tela, homologação e documentação.

## Ordem por dependência

### Fase A — fundações já necessárias

- estabilizar autenticação, tenant, permissões, jobs, storage e auditoria;
- concluir o fluxo canônico e a persistência das telas prioritárias;
- remover dependências Base44 restantes no caminho crítico;
- estabelecer contratos de ativo, versão, timeline, legenda e direitos.

### Fase B — modelo editorial e vídeo neutro

- criar entidades e schemas do motor de vídeo;
- criar adaptador falso determinístico e jobs persistentes;
- gerar checksum, dados técnicos, proxy, áudio, frames e thumbnails;
- normalizar transcrição, cenas, candidatos a corte e reframe;
- medir custo, latência, confiança e proveniência.

Entrega: `MM-AI-VIDEO-001`.

### Fase C — exportação profissional independente

- consolidar o modelo temporal racional;
- criar manifestos, relink, checksums e validação;
- implementar pacote sem mídia;
- implementar Premiere e DaVinci;
- acrescentar consolidado, proxy e demais NLEs por evidência.

Entrega: `MM-EXPORT-001`.

### Fase D — Clip Engine nativo

- implementar descoberta de segmentos e geração de candidatos sobre o domínio MediaMind;
- criar score explicável por contexto, autonomia, hook, valor editorial e adequação ao destino;
- automatizar IN/OUT sem perder ajuste manual e revisão humana;
- gerar legendas, remoção de pausas/vícios, reframe, thumbnail e render como etapas independentes e retomáveis;
- integrar versões, aprovação, exportação, publicação, feedback e aprendizado por tenant;
- medir qualidade, custo e latência de cada componente de IA sem terceirizar o motor de cortes.

Entrega: `MM-CLIP-ENGINE-001`, dependente de `MM-AI-VIDEO-001`.

### Fase E — Edge/CEDOC

- abstrair localização e storage sem mover os masters;
- criar simulador, agente piloto, pareamento e catálogo;
- habilitar derivados locais e retomada;
- pilotar em coleção não crítica;
- conectar jobs de IA e MEP somente após segurança e observabilidade.

Entrega: `MM-EDGE-001`.

### Fase F — RAG audiovisual e Knowledge

- indexar primeiro transcrições e metadados com chunks ligados a timecodes;
- combinar full-text, vetor, metadados, direitos e filtros multitenant;
- integrar resultados à Pesquisa e ao Workspace 2 existentes;
- expandir depois para OCR, pessoas, roteiros, projetos e regras editoriais;
- avaliar recuperação, proveniência, remoção e reindexação antes de abrir uso por agentes.

Entregas: `MM-RAG-001` e `MM-KNOWLEDGE-001`.

### Fase G — MCP e aprendizado

- expor primeiro resources e tools somente leitura sobre serviços internos;
- adicionar ações idempotentes apenas após autorização e auditoria comprovadas;
- registrar sugestões e correções humanas como eventos separados de telemetria;
- avaliar fine-tuning somente com dataset consentido, baseline e ganho mensurável.

Entregas: `MM-MCP-READ-001`, `MM-MCP-ACTIONS-001`, `MM-AI-FEEDBACK-001` e, futuramente, `MM-FINETUNE-001`.

## Relações com as telas existentes

- **Pesquisa/Workspace 2:** usam metadados e análises normalizadas.
- **Modo Roteiro/Timeline:** usam referências estáveis, IN/OUT e transcrição.
- **Cortes/Redes sociais:** usam candidatos, score, reframe e legendas.
- **Em edição/Em aprovação:** revisam versões e comentários sem perder proveniência.
- **Finalizado/Para publicar/Publicações:** consomem versões aprovadas; não iniciam novo processamento silencioso.
- **Analytics:** mede desempenho editorial, operacional e custo de IA, sem misturar métricas de audiência com telemetria técnica.
- **Acervo:** mantém direitos, localização, disponibilidade e derivados.
- **Gestão/Administração:** configura provedores, quotas, políticas, Edge Agents e permissões.

## Gates antes de produção

1. contrato e migration compatíveis;
2. testes unitários, integração, segurança e fluxo crítico;
3. teste com mídia longa, taxa fracionária e conteúdo acentuado;
4. comparação visual/funcional nas telas afetadas;
5. plano de rollback e feature flag;
6. homologação sem regressão do Workspace 1 e do site publicado;
7. somente depois, commit/push/deploy controlado e canário.

## Fora do primeiro corte

- provisionamento automático de infraestrutura do cliente;
- Avid/AAF sem prova em instalação real;
- envio irrestrito de masters privados a terceiros;
- decisão automática de publicação ou aprovação pela IA;
- integração ou dependência operacional do OpusClip;
- dependência exclusiva de qualquer modelo ou fornecedor de IA.

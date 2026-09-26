# Catálogo de capacidades do MediaMind AI

Este catálogo reúne as funcionalidades úteis encontradas nas fontes de planejamento e nos materiais históricos. Ele descreve o produto desejado, não o estado implementado. Cada capacidade precisa passar por arquitetura, segurança, testes e aceite antes de mudar para concluída.

## 1. Acervo e ingestão profissional

- upload real, múltiplo e retomável, com pausa, cancelamento e retry por arquivo;
- checksum, deduplicação, quarentena, antivírus e validação técnica;
- masters, proxies, áudio, frames, thumbnails e derivados versionados;
- metadados de codec, resolução, frame rate racional, canais de áudio, timecode, origem, direitos e retenção;
- ingestão por upload, CEDOC, storage autorizado, gravação, projeto ou integração;
- jobs persistentes, idempotentes, retomáveis e auditáveis;
- arquivos privados e URLs assinadas, nunca upload público para material confidencial.

## 2. Media Intelligence reutilizável

Uma análise deve servir a Pesquisa, Workspace 2, Roteiro, Timeline, Cortes, Aprovação, Publicação e Analytics.

- transcrição por segmento e palavra, idioma, confiança e revisão;
- diarização e identificação/rotulagem de speakers;
- detecção de cenas, silêncio, pausas, pessoas, rostos, objetos, lugares e texto em imagem;
- OCR, entidades, assuntos, resumos, eventos e palavras-chave;
- embeddings de texto, imagem e, quando viável, vídeo;
- artefatos Bronze (originais), Silver (derivados normalizados) e Gold (insights editoriais);
- proveniência, versão do modelo, custo, latência e confiança em cada resultado.

## 3. Pesquisa audiovisual e RAG

- busca textual, semântica, visual, por metadados e híbrida;
- pesquisa no vídeo atual, projeto, programa, período, tenant ou CEDOC inteiro;
- resultados com asset, trecho, IN/OUT, speaker, contexto e motivo do match;
- abertura direta no player e envio para roteiro, timeline ou novo corte;
- filtros por programa, pessoa, assunto, local, data, editoria, direitos, tipo e status;
- resultados semelhantes e descoberta de B-roll no acervo autorizado;
- permissões aplicadas durante a recuperação, nunca depois dela.

## 4. Descoberta de melhores momentos

- seleção de finalidade: jornalística, social, informativa, institucional, comercial ou educacional;
- prompt editorial opcional e intervalo de análise;
- candidatos estruturados com IN/OUT, resumo, explicação, palavras-chave e destinos sugeridos;
- recuperação de contexto anterior/posterior;
- alternativas para o mesmo assunto;
- detecção de trecho autônomo, frase incompleta, pergunta sem resposta e contexto ausente;
- geração de poucos candidatos bons, evitando volume artificial de cortes ruins.

## 5. MediaMind Score explicável

- dimensões separadas para hook, fluxo, valor, autonomia, clareza, relevância editorial, qualidade técnica e adequação ao canal;
- perfis de peso por jornalismo, redes sociais, acervo, institucional, educação e comercial;
- nota, faixa, justificativa e sinais usados;
- score tratado como apoio editorial, nunca garantia de viralidade;
- comparação entre candidatos e calibração posterior com desempenho real;
- personalização por tenant somente após dados e avaliação suficientes.

## 6. Editor de cortes não destrutivo

- IN/OUT preciso e ajuste por frame/timecode;
- estender início/final, melhorar hook, recuperar contexto e encontrar alternativa;
- split, trim, drop, reorder, duplicate, ripple delete, markers e undo;
- múltiplos segmentos no mesmo corte;
- edição baseada em texto: localizar palavra, remover frase e criar corte pela seleção textual;
- waveform, transcript, captions e vídeo sincronizados;
- versões, autosave, histórico e comparação lado a lado;
- origem sempre preservada; decisões de edição ficam no modelo interno MediaMind.

## 7. Limpeza de fala

- detecção revisável de filler words, falsos inícios, repetições, pausas e silêncios longos;
- aplicação item a item ou em lote;
- preview antes/depois e desfazer;
- proteção contra remoção de conteúdo semanticamente importante;
- parâmetros por idioma, programa e política editorial.

## 8. Speakers, reenquadramento e Auto Director

- detecção, agrupamento e nomeação de speakers;
- face/person detection, tracking, foco e composição;
- keyframes de crop, scale, posição e rotação;
- presets 16:9, 9:16, 1:1 e outros formatos autorizados;
- enquadramento individual, dupla, entrevista, palco, tela dividida e layouts de marca;
- Auto Director baseado em quem fala e no contexto visual;
- revisão manual obrigatória e fallback estável quando tracking falhar.

## 9. Legendas nativas

- master lógico por frase e palavra, ligado à transcrição revisada;
- edição, divisão, união, timing, speaker, confiança e destaque de palavra ativa;
- fontes, cores, background, stroke, shadow, posição, safe area e templates de marca;
- SRT, VTT, TTML/iTT, ASS e formatos específicos por destino;
- overlays raster ou ProRes com alpha apenas quando fidelidade visual exigir;
- múltiplos idiomas, tradução/dublagem como capacidades futuras e separadas.

## 10. B-roll, gráficos e identidade

- busca prioritária no CEDOC e biblioteca MediaMind;
- fontes externas somente quando autorizadas e com direitos registrados;
- sugestão contextual por trecho, assunto, pessoa e local;
- lower thirds, CGs, logos, molduras, templates e brand kits versionados;
- geração por IA apenas quando permitida, identificada e revisada;
- nenhum asset gerado substitui silenciosamente material editorial real.

## 11. Aprovação e colaboração

- comentários por versão e timecode;
- solicitações de alteração, aprovação, rejeição e motivo;
- papéis e responsabilidade por etapa;
- comparação de versões e histórico imutável de decisões;
- notificações e prazos;
- passagem canônica entre edição, aguardando aprovação, aprovação e finalização.

## 12. Exportação e interoperabilidade

- MediaMind Export Package com manifest, checksums e relatório de validação;
- Premiere e DaVinci primeiro; Final Cut depois; Avid/AAF somente após prova real;
- OTIO/EDL como intercâmbio dentro de seus limites;
- legenda editável por padrão e overlay visual opcional;
- mídia ligada ao CEDOC, consolidada com handles, proxy, completa ou ausente;
- relink por identificador/checksum e aliases Windows/macOS/Linux;
- preservação de frame rate racional, DF/NDF, timecode e sincronismo.

## 13. CEDOC e Edge

- masters podem permanecer na emissora;
- agente pareado publica catálogo e derivados autorizados, não compartilhamentos internos;
- processamento local de proxy, transcrição, frames, embeddings ou render conforme política;
- funcionamento com conexão intermitente, retomada e deduplicação;
- path mapping, integridade, direitos e disponibilidade;
- perfis CPU, GPU local, nuvem mínima e processamento híbrido.

## 14. Publicação e redes sociais

- preparar variações por canal sem alterar o master;
- títulos, descrições, hashtags, thumbnails e formatos sugeridos;
- checklist de direitos, legenda, identidade, aprovação e credenciais;
- fila `Para publicação`, publicação idempotente, retry e histórico;
- agendamento e publicação somente por conectores autorizados;
- decisão final humana e bloqueio explícito quando faltar requisito.

## 15. Analytics e ciclo de aprendizado

- métricas editoriais, operacionais, audiência e custo separadas;
- desempenho por corte, canal, formato, programa e tenant;
- comparação entre score sugerido e resultado real;
- feedback de seleção, rejeição, edição de IN/OUT, legenda e reframe;
- datasets consentidos e versionados;
- avaliação offline antes de reranking, personalização ou fine-tuning.

## 16. Orquestração, provedores e custo

- AI Provider Layer neutra para transcrição, visão, LLM e embeddings;
- processamento local primeiro quando cumprir qualidade, prazo e política;
- serviços externos sob demanda para tarefas difíceis ou picos;
- estimativa e confirmação de custo antes de trabalho caro;
- quotas, budgets, cache, reutilização e prevenção de cobrança duplicada;
- fallback sem reduzir qualidade silenciosamente;
- nenhum fornecedor controla o domínio, score, timeline ou experiência MediaMind.

## 17. Automação e MCP

- assistente consulta contexto por RAG e APIs internas;
- MCP começa read-only e herda exatamente as permissões do usuário;
- ações criam clips, projetos ou vínculos apenas com idempotência e auditoria;
- aprovação, exportação e agendamento exigem confirmação;
- banco, storage e secrets nunca são expostos diretamente a agentes;
- cada tool informa escopo, efeito, erro seguro e correlação.

## 18. Segurança, confiabilidade e governança

- tenant e direitos em toda entidade, query, job, arquivo e evento;
- RLS como segunda barreira quando o modelo estiver estabilizado;
- auditoria append-only criada pelo servidor;
- rate limit, timeout, retry, circuit breaker e dead-letter queue;
- feature flags, canário, rollback e observabilidade;
- classificação de conteúdo e redaction antes de provedores externos;
- retenção, exportação, eliminação e base legal documentadas;
- nenhuma ação aparente sem backend: conectar, desabilitar ou identificar claramente como planejada.

## Referências do catálogo

- [Plano mestre de IA](00_RAG_MCP_FINETUNING_MASTER.md)
- [Plano incremental](01_IMPLEMENTATION_PLAN.md)
- [Estratégia de provedores](../VIDEO_AI_PROVIDER_STRATEGY.md)
- [MediaMind Export Package](../MEDIAMIND_EXPORT_PACKAGE.md)
- [Edge/CEDOC](../EDGE_CEDOC_ARCHITECTURE.md)
- [Backlog executável](../CODEX_BACKLOG.md)

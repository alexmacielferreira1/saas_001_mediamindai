# Plano incremental de implementação de IA

Este plano transforma a arquitetura em entregas pequenas e verificáveis. Cada fase termina com código, migrations, testes, documentação e evidência. Não iniciar várias fases profundas em paralelo.

## Fase 0: auditoria e contratos

- [ ] Mapear ativos, transcrições, busca, storage, tenants, memberships, permissões e auditoria existentes.
- [ ] Definir contratos internos de `Document`, `Chunk`, `Embedding`, `RetrievalResult` e `AIJob` antes do fornecedor.
- [ ] Confirmar política de dados locais, externos e sensíveis.
- [ ] Criar fixtures multitenant e critérios de avaliação.

Saída: arquitetura atualizada, ADRs necessários e nenhuma mudança silenciosa de produto.

## Fase 1: fundação RAG

- [ ] Validar pgvector na infraestrutura alvo e estratégia de migration/rollback.
- [ ] Criar entidades de documento, chunk, versão de embedding e job de ingestão, reutilizando modelos existentes quando possível.
- [ ] Implementar adaptador determinístico de embeddings para testes.
- [ ] Aplicar filtros de tenant/organização/direitos dentro da consulta.
- [ ] Criar reindexação idempotente e eliminação de chunks antigos.

Aceite: dois tenants com conteúdo semelhante nunca recebem resultados cruzados; repetir ingestão não duplica chunks.

## Fase 2: primeiro corte vertical audiovisual

- [ ] Ingerir uma transcrição real autorizada.
- [ ] Gerar chunks que respeitem frases e mantenham `start_ms`/`end_ms`.
- [ ] Implementar busca híbrida com texto, vetor e metadados.
- [ ] Retornar ativo, trecho, IN, OUT, score e razão do match.
- [ ] Abrir o resultado no player existente sem criar outra experiência de busca.

Aceite: consulta de referência encontra o trecho correto e posiciona o player no timecode esperado.

## Fase 3: Knowledge

- [ ] Acrescentar OCR e metadados técnicos.
- [ ] Acrescentar roteiros, pautas e projetos com conectores separados.
- [ ] Acrescentar regras editoriais e documentos autorizados.
- [ ] Implementar atualização, retenção, exclusão e reconstrução por `source_type`.
- [ ] Exibir proveniência e data da indexação.

Aceite: cada resposta informa fontes e respeita alteração ou retirada da origem.

## Fase 4: MCP somente leitura

- [ ] Publicar resources e tools de leitura sobre a camada de serviço, nunca sobre SQL direto.
- [ ] Implementar autenticação, escopos, limites, auditoria e respostas paginadas.
- [ ] Validar prompts adversariais, enumeração de IDs e acesso cruzado.
- [ ] Testar com pelo menos um cliente compatível sem acoplar o produto a ele.

Aceite: um agente autorizado pesquisa e lê apenas recursos que o mesmo usuário acessaria na UI/API.

## Fase 5: MCP com ações controladas

- [ ] Adicionar criação de corte e inclusão em projeto/roteiro com idempotência.
- [ ] Exigir confirmação para aprovação, exportação e agendamento.
- [ ] Bloquear publicação automática pela IA.
- [ ] Registrar ator humano, cliente MCP, argumentos saneados e resultado.

Aceite: repetir uma ação não duplica objetos ou cobrança; operações sensíveis sem confirmação falham fechadas.

## Fase 6: feedback learning

- [ ] Criar eventos append-only de sugestão, decisão e correção.
- [ ] Separar telemetria operacional de dados de treinamento.
- [ ] Criar consentimento, retenção, anonimização e exportação por tenant.
- [ ] Construir avaliação offline e dashboards de qualidade/custo.

Aceite: é possível reproduzir a comparação entre sugestão e decisão sem expor conteúdo de outro tenant.

## Fase 7: decisão de fine-tuning

- [ ] Comparar regras, prompting, RAG, reranking e modelo base.
- [ ] Treinar somente se houver ganho definido em métrica e custo total.
- [ ] Começar por uma tarefa estreita e reversível.
- [ ] Versionar dataset, receita, modelo, avaliação e rollback.

Aceite: implantação canário supera o baseline sem piorar segurança, custo ou qualidade editorial.

## Ordem integrada com vídeo

1. Concluir fundações de autenticação, tenant, jobs, storage e auditoria.
2. Entregar RAG audiovisual básico.
3. Reutilizar transcrição/análise no domínio neutro `MM-AI-VIDEO-001`.
4. Implementar Clip Engine e MEP sem dependência operacional de OpusClip.
5. Adicionar MCP de leitura, depois ações.
6. Coletar feedback antes de avaliar fine-tuning.

## O que não fazer agora

- Não instalar outro agente como substituto da arquitetura do produto.
- Não colocar modelos locais diretamente no banco ou nas telas.
- Não dar a um MCP acesso amplo ao PostgreSQL, storage ou secrets.
- Não usar fine-tuning para atualizar conhecimento do acervo.
- Não implementar integração, adaptador, fallback, API, MCP ou credencial do OpusClip. Ele é somente benchmark; a decisão ativa e o destino são o motor próprio do MediaMind.
- Não prometer limites, preços ou recursos de fornecedor sem validação oficial no momento da implementação.

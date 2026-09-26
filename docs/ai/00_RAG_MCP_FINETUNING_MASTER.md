# MediaMind AI: plano mestre de RAG, MCP e fine-tuning

## Objetivo

Adicionar uma camada de inteligência capaz de pesquisar o acervo por significado e timecode, reutilizar conhecimento editorial, permitir operações controladas por agentes e aprender com correções humanas. A evolução preserva a interface, o workflow editorial, a identidade visual e a propriedade dos dados e decisões pelo MediaMind.

## Estado atual verificado

- O backend possui um adaptador protegido em `/api/v1/ai/functions/{function_name}`, mas ainda responde `AI_PROVIDER_NOT_CONFIGURED`.
- A estratégia de vídeo já exige contratos neutros, jobs persistentes, auditoria, quotas e revisão humana.
- O Clip Engine, o MediaMind Export Package e o Edge Agent estão planejados, não concluídos.
- OpusClip é benchmark funcional. Não é dependência ativa nem fornecedor aprovado do produto.
- Ainda não existe implementação comprovada de pgvector, ingestão RAG, servidor MCP do MediaMind ou pipeline de fine-tuning.

## Princípios obrigatórios

1. O código e as decisões registradas no repositório são a fonte de verdade.
2. RAG guarda conhecimento dinâmico; fine-tuning não substitui o acervo pesquisável.
3. MCP expõe recursos e ações do MediaMind; não contorna APIs, autorização ou auditoria.
4. Toda recuperação aplica tenant, organização, usuário, direitos e classificação antes de retornar candidatos.
5. IA sugere. Aprovação, publicação e ações sensíveis permanecem humanas.
6. Processamento usa jobs idempotentes, retomáveis e observáveis.
7. Resultados de transcrição, OCR, análise e embeddings são versionados e reutilizados entre telas.
8. Segredos ficam no backend. Prompt, transcrição sensível e payload bruto não entram em logs comuns.
9. Modelos locais e externos entram por contratos neutros e políticas por tenant.
10. Fine-tuning só começa com dataset real, consentido, versionado e mensurável.

## Decisão de produto: OpusClip

O OpusClip serve exclusivamente como benchmark de funcionalidades, fluxos e qualidade percebida. O MediaMind pode estudar seleção de melhores momentos, score, legendas, remoção de pausas, reframe, thumbnails, exportação e publicação para definir seus próprios requisitos.

Não fazem parte do destino arquitetural:

- integrar API ou MCP do OpusClip;
- cadastrar ou consumir chave do OpusClip;
- criar adaptador ou fallback operacional para o OpusClip;
- guardar `provider_project_id`, `provider_clip_id` ou outros identificadores dele;
- enviar masters, transcrições ou decisões editoriais para processamento pelo OpusClip;
- reproduzir limitações comerciais ou técnicas do fornecedor como regras do domínio.

O destino é um motor próprio do MediaMind. Componentes de transcrição, embeddings, compreensão multimodal e visão computacional podem ser locais ou externos, desde que usem contratos neutros e possam ser substituídos sem alterar a interface, o workflow, o algoritmo editorial, o score ou a timeline.

## Arquitetura-alvo

```text
Usuário e telas MediaMind
          |
          v
FastAPI + autorização + auditoria
          |
          +---------------------+
          |                     |
          v                     v
Orquestrador de IA         MediaMind MCP
          |               resources + tools
    +-----+------+              |
    |            |              v
    v            v        APIs internas estáveis
Busca híbrida  Jobs de mídia
    |            |
    v            v
PostgreSQL     FFmpeg/transcrição/visão
+ pgvector     por adaptadores neutros
    |
    v
Knowledge: acervo, timecodes, OCR, pessoas, roteiros,
projetos, regras editoriais, comentários e histórico
```

## RAG audiovisual

O primeiro recorte útil é uma busca que retorna mídia, texto e intervalo temporal, não um chat genérico. Cada unidade recuperável deve manter no mínimo:

- `tenant_id` e `organization_id`;
- `source_type` e identificador estável da fonte;
- `asset_id`, quando a origem for audiovisual;
- texto normalizado;
- `start_ms` e `end_ms`, quando aplicável;
- metadados e classificação de acesso;
- versão do extrator, embedding e conteúdo;
- checksum e timestamps de criação/atualização.

A classificação final combina busca textual, similaridade vetorial, filtros de metadados, direitos e permissões. O sistema deve conseguir explicar por que um resultado apareceu e abrir o player no timecode correto.

## MediaMind Knowledge

A camada Knowledge incorpora fontes aos poucos:

1. transcrições e metadados de ativos;
2. OCR, pessoas, objetos, locais, cenas e assuntos;
3. roteiros, pautas, projetos, comentários e aprovações;
4. manuais, regras editoriais e documentação autorizada;
5. histórico e feedback humano adequado para aprendizado.

Cada origem possui `source_type`, política de retenção, proveniência e regra de atualização. Conteúdo removido ou sem direito não pode permanecer recuperável por embedding órfão.

## MCP do MediaMind

O servidor MCP começa somente quando autenticação, autorização e APIs internas estiverem estáveis. A primeira versão é somente leitura.

Resources iniciais propostos:

- `mediamind://asset/{id}`
- `mediamind://transcript/{id}`
- `mediamind://project/{id}`
- `mediamind://script/{id}`
- `mediamind://workflow/{id}`

Tools iniciais de leitura:

- `search_media`
- `get_asset`
- `get_transcript`
- `get_timecode_context`
- `get_project`
- `get_script`
- `get_clip`

Ações como `create_clip`, `add_media_to_script`, `request_approval`, `export_editor_package` e `schedule_publication` entram depois, com escopos próprios, confirmação para operações sensíveis, idempotência e trilha de auditoria. O MCP nunca recebe acesso direto ao banco.

## Feedback e aprendizado

Registrar pares entre sugestão e decisão humana, sem apagar o original:

- consulta e resultado escolhido;
- IN/OUT sugerido e IN/OUT final;
- transcrição sugerida e correção;
- tags, título, editoria e classificação sugeridos e finais;
- reframe/legenda sugeridos e ajustes;
- motivo de descarte ou aprovação, quando informado.

Esses eventos alimentam avaliação offline antes de qualquer treinamento. Métricas mínimas incluem precisão de recuperação, taxa de aceitação, deslocamento de IN/OUT, correções por minuto, custo, latência e incidência de vazamento entre tenants igual a zero.

## Fine-tuning

Fine-tuning fica fora do primeiro ciclo. Só será considerado quando houver:

- volume suficiente de exemplos reais e representativos;
- licença, consentimento, retenção e anonimização definidos;
- conjunto de avaliação separado e baseline reproduzível;
- ganho mensurável sobre prompt, regras, RAG ou modelo base;
- rollback de modelo e registro de versão/proveniência.

Priorizar modelos pequenos e especializados, como classificador editorial, tagger, interpretador de busca e ranker de cortes. Não treinar o modelo para memorizar o acervo.

## Relação com o Clip Engine

RAG localiza e contextualiza trechos. O Clip Engine cria e classifica candidatos. O MediaMind Export Package leva decisões aprovadas aos editores. O Edge Agent processa masters locais quando a política exigir. São domínios ligados, mas não devem virar um serviço monolítico.

## Gates de produção

- isolamento multitenant testado antes e depois da recuperação;
- exclusão e reindexação sem embeddings órfãos;
- avaliações com consultas reais e casos negativos;
- quotas, timeout, retry, circuit breaker e custo por operação;
- redaction e política para conteúdo enviado a modelos externos;
- autorização e confirmação por tool MCP;
- observabilidade sem registrar segredos ou conteúdo sensível;
- feature flags, canário e rollback.

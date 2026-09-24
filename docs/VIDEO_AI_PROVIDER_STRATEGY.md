# Estratégia de provedores de vídeo e IA

## Objetivo

Evoluir o MediaMind para analisar, recortar e preparar vídeo com IA sem prender o produto a um fornecedor. A interface, o fluxo editorial, os dados, o algoritmo de seleção, o score e as decisões permanecem do MediaMind. Modelos de IA entram por adaptadores no backend; plataformas completas de corte não são dependências do produto.

## Princípios obrigatórios

- O navegador nunca recebe segredo de provedor.
- A UI não conhece nomes, payloads ou estados internos de APIs externas.
- Todo processamento é um job persistente, retomável, idempotente e auditável.
- Um resultado normalizado pode ser reutilizado por Pesquisa, Roteiro, Workspace 2, Timeline, Cortes, Publicação, Analytics e Exportação.
- Falha ou indisponibilidade de um provedor não corrompe o projeto e não bloqueia edição manual.
- Custos, créditos e limites comerciais são configuração operacional, não regra de domínio.

## Contrato de domínio

Entidades mínimas:

- `MediaAsset`: mídia de origem, localização, checksum, direitos, duração, codec e frame rate.
- `AnalysisJob`: pedido, estado, tentativas, provedor, custo estimado/real e correlação.
- `Transcript`: segmentos com tempo, locutor, confiança, idioma e texto revisável.
- `Shot` e `Scene`: limites temporais, pessoas, objetos, assuntos e qualidade.
- `ClipCandidate`: IN/OUT, motivo, score, categoria editorial e formatos sugeridos.
- `ReframeTrack`: proporção, crop e keyframes por destino.
- `CaptionTrack`: conteúdo lógico, estilo e versões exportáveis.
- `ProviderArtifact`: referência técnica ao resultado bruto para diagnóstico, sem contaminar o domínio.

Estados de job: `queued`, `uploading`, `processing`, `review_required`, `completed`, `failed`, `cancelled`.

## Interface do provedor

Cada adaptador deve implementar, conforme sua capacidade:

1. validar configuração e disponibilidade;
2. preparar ou retomar upload;
3. iniciar análise/corte/transcrição;
4. consultar ou receber atualização de estado;
5. normalizar resultados no modelo MediaMind;
6. cancelar e limpar artefatos temporários;
7. informar uso, custo e limites;
8. preservar resposta bruta com retenção controlada para suporte.

O roteador escolhe provedor por tenant, política, tipo de mídia, sensibilidade, custo, região e capacidade. A seleção deve ser registrada no job.

## OpusClip como benchmark somente

O OpusClip foi estudado para mapear capacidades de produto, não para ser integrado. Não criar adaptador, credencial, chamada REST/MCP, persistência de IDs externos ou dependência de processamento. Referências a IN/OUT, melhores momentos, score, remoção de pausas, legendas, reframe, thumbnail e exportação servem para definir requisitos do motor próprio.

Provedores contratáveis nesta arquitetura são componentes de IA e mídia atrás de contratos neutros, como transcrição, compreensão multimodal, embeddings, detecção/tracking e geração de texto. O MediaMind combina e normaliza esses resultados, decide os cortes e controla todo o ciclo editorial.

## Motor independente

O caminho nativo pode combinar:

- FFmpeg/ffprobe para ingestão, proxy, áudio, frames, corte e render;
- transcrição e diarização por provedor configurável ou execução local;
- modelos multimodais para contexto, relevância e classificação editorial;
- visão computacional para pessoa, objeto, enquadramento e movimento;
- regras MediaMind para score, direitos, formato, canal e prioridade.

Não se deve processar a mesma mídia separadamente para cada tela. A análise gera artefatos versionados, endereçados por checksum e reutilizáveis.

## Segurança, privacidade e governança

- autorização por tenant e por ação;
- classificação de conteúdo antes do envio externo;
- redaction quando aplicável;
- log de quem pediu, o que foi enviado, provedor, região, versão do modelo, custo e resultado;
- quotas por tenant, usuário e função;
- rate limit, timeout, retry com backoff e fila de falhas;
- expiração e eliminação verificável de artefatos temporários;
- IA sugere; aprovação editorial permanece humana.

## Entrega por fases

1. **Contrato e simulação:** entidades, schemas, estados, adaptador falso determinístico e telemetria.
2. **Pipeline local:** ffprobe, proxy, áudio, frames, checksum e persistência.
3. **Primeiro componente de IA real:** uma capacidade de baixo risco, como transcrição ou análise estruturada, com feature flag e limites.
4. **Cortes normalizados:** candidatos, score, IN/OUT, transcrição e revisão humana.
5. **Reframe e legendas:** variantes por canal, sem duplicar o ativo original.
6. **Roteamento híbrido:** componentes externos de IA, execução local e processamento Edge conforme política, sempre sob o motor MediaMind.

## Critérios de aceite

- Trocar o adaptador não exige alteração nas telas consumidoras.
- Repetir uma solicitação idempotente não duplica cobrança nem projeto.
- Jobs sobrevivem a reinício e exibem progresso e erro compreensível.
- Todo resultado informa fonte, versão e confiança.
- Usuário consegue revisar e corrigir transcrição, corte, legenda e enquadramento.
- Custos e uso podem ser filtrados por tenant, projeto, provedor e função.
- Nenhum segredo aparece no bundle, logs de cliente ou pacote exportado.

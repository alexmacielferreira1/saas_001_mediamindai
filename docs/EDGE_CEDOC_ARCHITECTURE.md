# Arquitetura Edge e CEDOC

## Objetivo

Permitir que emissoras e produtoras usem o MediaMind mantendo masters no CEDOC, NAS, SAN ou armazenamento local. O sistema central cataloga e trabalha com referências e derivados leves; a movimentação do master é explícita e governada.

## Componentes

### MediaMind Edge Agent

Serviço instalado na rede do cliente, com configuração administrada e escopo de pastas autorizado. Responsabilidades:

- observar pastas e filas de ingestão;
- identificar estabilidade do arquivo antes de processar;
- executar `ffprobe`, checksum e deduplicação;
- gerar proxy, áudio, frames e thumbnails;
- executar análise local permitida;
- enviar metadados e derivados autorizados;
- receber jobs pela conexão segura iniciada de dentro para fora;
- retomar uploads e reportar saúde, versão e capacidade.

O agente não expõe compartilhamentos internos diretamente à internet.

### Catálogo central

Mantém `media_id`, storage, caminho lógico, checksum, duração, codec, resolução, frame rate, direitos, derivados e análise. Caminhos físicos não devem ser usados como identidade do ativo.

### Gateway local de mídia

Quando permitido, fornece streaming de proxy e acesso controlado ao master dentro da rede. Tokens são curtos, vinculados ao usuário, tenant e finalidade.

## Modos de implantação

- **Local/CEDOC:** masters e derivados sensíveis permanecem locais; a nuvem recebe apenas catálogo autorizado.
- **Híbrido:** master local, proxies/metadados selecionados na nuvem.
- **Nuvem:** mídia e derivados em storage gerenciado, com a mesma abstração de localização.

A política é configurada por tenant, coleção, classificação e projeto — nunca hardcoded por tela.

## Camadas de informação

- **Bronze:** fonte, checksum, informações técnicas e metadados brutos.
- **Silver:** proxy, transcrição, pessoas, objetos, assuntos, cenas e dados normalizados.
- **Gold:** cortes aprovados, roteiros, timelines, legendas, versões e pacotes de entrega.

Cada derivado informa fonte, versão do processo e data, permitindo reprocessar sem perder o histórico editorial.

## Confiabilidade

- detecção de arquivo ainda em gravação ou cópia;
- filas locais persistentes e retomáveis;
- operações idempotentes por checksum + versão da receita;
- retry com backoff e fila de falhas;
- limite de CPU, GPU, disco e banda configurável;
- cache e limpeza por retenção, nunca por exclusão silenciosa;
- atualização assinada do agente e rollback de versão;
- métricas de fila, espaço, throughput, falhas e última comunicação.

## Segurança

- pareamento inicial autenticado e revogável;
- mTLS ou canal equivalente, rotação de certificados e identidade por instalação;
- credenciais de storage guardadas localmente em cofre do sistema;
- lista explícita de raízes permitidas e proteção contra traversal/symlink indevido;
- criptografia em trânsito e, quando aplicável, em repouso;
- auditoria de leitura, cópia, exportação e eliminação;
- suporte a análise totalmente local para conteúdo privado;
- política de direitos e retenção aplicada antes de qualquer envio externo.

## Fluxo principal

1. Operador autoriza uma origem e política.
2. Agente detecta arquivo estável, calcula checksum e registra o ativo.
3. Agente gera derivados previstos pela política.
4. Catálogo central recebe metadados e disponibiliza o ativo às telas autorizadas.
5. Jobs de IA são executados localmente ou enviados a provedor permitido.
6. Roteiro/timeline usam referências estáveis ao ativo.
7. Exportação escolhe link CEDOC, proxy, consolidado ou mídia completa.

## Plano de implementação

1. Especificar contrato de storage e identificadores independentes de caminho.
2. Criar simulador local do agente e testes com pastas temporárias.
3. Implementar ingestão técnica, checksum e catálogo sem upload de master.
4. Adicionar proxy/thumbnail/áudio e retomada.
5. Adicionar pareamento, telemetria, atualização e política de recursos.
6. Pilotar com um conjunto não crítico e medir falhas/relink.
7. Só então habilitar análise local/externa e exportações com master.

## Critérios de aceite

- Arquivo permanece utilizável após mudança de caminho por meio de relink controlado.
- Reiniciar agente ou conexão não duplica ativo nem job.
- Nenhum compartilhamento interno fica publicamente acessível.
- Um tenant não descobre caminho, proxy ou metadados de outro.
- Perda do agente não elimina o catálogo nem o histórico editorial.
- Operador vê status, última comunicação, fila, capacidade e erro acionável.
- A exclusão respeita retenção e produz evidência auditável.


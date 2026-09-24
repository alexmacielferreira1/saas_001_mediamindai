# MediaMind Export Package (MEP)

## Objetivo

Exportar cortes, timelines, reenquadramentos, áudio, legendas, metadados e mídias auxiliares para editores externos sem depender de um formato proprietário ou do OpusClip.

## Diretriz arquitetural

O MediaMind mantém um modelo editorial interno único e versionado. Premiere, DaVinci, Final Cut, Avid e formatos de intercâmbio são adaptadores de saída. Nenhuma decisão editorial deve existir apenas dentro de XML específico de um editor.

## Alvos e ordem

1. Adobe Premiere e DaVinci Resolve no MVP, validados com projetos reais.
2. Final Cut Pro após estabilizar o modelo temporal e de legendas.
3. OTIO/EDL para intercâmbio compatível com seus limites.
4. Avid/AAF somente depois de uma prova técnica de importação, relink e efeitos.

## Modos de mídia

- **CEDOC/link:** manifesto e caminhos lógicos para relink dentro da emissora.
- **Consolidado:** apenas intervalos usados, com handles configuráveis.
- **Proxy:** pacote leve para edição remota.
- **Mídia completa:** cópia dos arquivos autorizados.
- **Timeline e legendas:** sem mídia, para ambientes que já possuem os masters.

## Estrutura lógica do pacote

```text
MediaMind-Export-<job-id>.zip
  manifest.json
  source_manifest.json
  relink_map.json
  checksums.sha256
  export_validation.json
  timelines/
  captions/
    captions.json
    captions.srt
    captions.vtt
  media/
  audio/
  overlays/
  thumbnails/
  reports/
```

Arquivos e diretórios variam pelo modo e pelo NLE. `captions.json` é o mestre lógico; formatos derivados nunca são a única fonte editável.

## Tempo e sincronismo

- Representar frame rate como racional, por exemplo `30000/1001`.
- Guardar DF/NDF explicitamente.
- Converter tempo para frames com política única e testes de borda.
- Preservar timecode de origem, timecode de sequência, IN/OUT e handles.
- Guardar crop/reframe e keyframes em coordenadas normalizadas.
- Não arredondar silenciosamente durações ou offsets.

Aceite temporal do MVP: importar o pacote e manter áudio, vídeo, cortes e legendas sincronizados com erro máximo de um frame nos casos suportados.

## Legendas e overlays

- Saídas textuais previstas: SRT, WebVTT, TTML/iTT e ASS conforme o destino.
- Conteúdo, timing e estilo ficam separados.
- Premiere e DaVinci devem receber legenda editável por padrão.
- PNG/WebP/GIF ou ProRes 4444 com alpha podem ser gerados opcionalmente para fidelidade visual.
- Texto usa UTF-8, com testes para acentos, emoji, múltiplas linhas e idiomas RTL quando suportados.

## Manifestos e relink

`manifest.json` identifica versão do MEP, tenant, projeto, exportador, data, usuário, modo, frame rate e artefatos. `source_manifest.json` descreve fontes e intervalos. `relink_map.json` relaciona o identificador estável aos caminhos candidatos Windows, macOS e Linux. Checksums verificam integridade sem usar o caminho como identidade.

## API e jobs

Entrada proposta:

`POST /api/v1/exports/editor-package`

O pedido informa projeto/versão, destino, modo de mídia, handles, formatos de legenda e opções de overlay. A resposta cria job assíncrono.

Estados: `queued`, `collecting`, `rendering`, `packaging`, `validating`, `ready`, `failed`, `expired`, `cancelled`.

O download usa URL assinada de curta duração. Repetir a mesma chave idempotente não cria pacotes duplicados.

## Segurança

- autorização por tenant, projeto, ativo e tipo de exportação;
- nomes internos saneados e caminhos normalizados;
- bloqueio de path traversal, ZIP Slip, symlink indevido e arquivos fora das raízes permitidas;
- nenhum segredo, token permanente ou credencial de CEDOC dentro do ZIP;
- limites de tamanho, quantidade de entradas e expansão do arquivo;
- logs e pacotes temporários com retenção definida;
- auditoria de criação, download, expiração e eliminação.

## Validação automática

`export_validation.json` registra:

- arquivos esperados e checksums;
- duração e frame rate;
- quantidade de clips e captions;
- mídia ausente ou offline;
- intervalos inválidos e sobreposições inesperadas;
- warnings específicos do exportador;
- versão da receita e resultado final.

## Entrega por fases

1. Modelo editorial e fixture canônica de teste.
2. Manifestos, checksums, zip seguro e modo sem mídia.
3. Premiere com legenda editável e relink.
4. DaVinci com os mesmos casos de aceite.
5. Consolidado/proxy com handles e validação de mídia.
6. Final Cut e formatos de intercâmbio.
7. Avid/AAF após prova de viabilidade.

## Critérios de aceite

- Pacote abre no NLE suportado sem correção manual estrutural.
- Relink funciona nos sistemas operacionais declarados.
- Sincronismo fica dentro de um frame.
- Legendas continuam editáveis e preservam caracteres.
- Checksums e validação detectam pacote incompleto ou alterado.
- Falha deixa diagnóstico claro e não libera pacote parcial como pronto.
- Pacote expirado deixa de ser baixável sem apagar o histórico do job.


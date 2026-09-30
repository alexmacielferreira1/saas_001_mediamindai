# Uso, custos e cobrança do MediaMind AI

## Objetivo

Medir o custo real de processamento por tenant, projeto, ativo, job, provedor e capacidade, permitindo incluir franquias nos planos e cobrar excedentes sem expor a infraestrutura interna ao cliente.

O cliente compra **Processamento Inteligente de Mídia MediaMind**, não minutos de um fornecedor específico.

## Princípios

- Provedores são substituíveis e nunca definem o produto comercial.
- Toda operação paga possui estimativa, reserva, uso real e reconciliação.
- Repetição idempotente não gera cobrança duplicada.
- Transcrição, análise, indexação, render, storage e tráfego são medidos separadamente.
- Cache e reutilização de artefatos evitam reprocessamento e nova cobrança.
- Custos compartilhados possuem regra de rateio versionada e auditável.
- Valores e limites vêm de configuração comercial; não ficam hard-coded.
- Preços externos são referências temporais e precisam de verificação antes de proposta comercial.

## Modelo de consumo

Unidades possíveis:

- minutos de fonte analisada ou transcrita;
- minutos renderizados;
- GB-mês de master, proxy e derivados;
- quantidade de buscas/indexações;
- tokens ou unidades normalizadas de IA;
- jobs, exportações e publicações;
- usuários/assentos e ambientes.

Entidades conceituais: `UsageEvent`, `CostRate`, `CostRecord`, `Quota`, `Entitlement`, `UsageReservation`, `InvoiceLineReference` e `ProviderAccount`. Antes de criar tabelas, mapear equivalentes existentes na Central e no MediaMind.

## Fluxo

1. O frontend solicita uma operação.
2. O backend calcula consumo estimado e verifica entitlement/quota.
3. Uma reserva idempotente é criada.
4. O job executa no provedor/local/Edge escolhido pela política.
5. Métricas reais são normalizadas em `UsageEvent`.
6. O custo real é calculado com a tabela vigente no instante da execução.
7. Reserva e uso são reconciliados; falha não confirmada não vira sucesso faturável.
8. A Central agrega uso, custo, franquia, excedente e margem por tenant/período.

## Estratégia comercial

Planos podem combinar mensalidade, franquia e excedente. Exemplos de dimensões: horas de transcrição, processamento IA, renders, buscas, storage, usuários e jobs concorrentes. O cliente visualiza saldo, consumo, estimativa e histórico com nomenclatura MediaMind.

Clientes corporativos podem usar conta própria de provedor (`bring your own provider`) quando permitido. Segredos permanecem no backend/cofre e nunca chegam ao navegador.

## Roteamento econômico

- Corte por IN/OUT conhecido: FFmpeg, sem IA desnecessária.
- Transcrição: provedor de fala ou execução local.
- Corte inteligente: transcrição + análise multimodal + regras/score MediaMind + FFmpeg.
- Pesquisa semântica: indexação somente quando a política do acervo exigir.
- Conteúdo sensível ou grande volume: Edge/on-prem quando disponível.

OpusClip permanece benchmark/fallback opcional, nunca dependência estrutural. O motor próprio combina contratos descritos em `VIDEO_AI_PROVIDER_STRATEGY.md`, storage/Edge de `EDGE_CEDOC_ARCHITECTURE.md` e exportação de `MEDIAMIND_EXPORT_PACKAGE.md`.

## CEDOC e redução de custo

Masters podem permanecer em NAS/SAN/HDs do cliente. O MediaMind cataloga e processa proxies, áudio, frames e metadados conforme política. Isso reduz storage e transferência do SaaS, mas não deve ser vendido como custo físico literalmente zero para a emissora.

## Segurança e auditoria

- isolamento por tenant;
- autorização para consultar custos e alterar quotas;
- segredo mascarado e rotacionável;
- registro de provedor/modelo/versão/região;
- redaction e política de conteúdo antes de envio externo;
- trilha de estimativa, reserva, execução, reconciliação e ajuste manual;
- alertas de orçamento, anomalia e aproximação de limite.

## Critérios de aceite

- Consumo pode ser explicado até o job e ativo que o gerou.
- Repetir a chave idempotente não duplica uso ou cobrança.
- Falha e cancelamento possuem política explícita.
- Trocar provedor não altera a UI nem o contrato comercial.
- Tenant não enxerga custo ou consumo de outro tenant.
- Central consegue consolidar uso, custo, receita e margem sem inventar dados ausentes.

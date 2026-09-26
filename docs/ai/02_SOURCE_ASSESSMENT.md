# Registro das fontes incorporadas em 25/09/2026

## Origem

Quatro textos fornecidos pelo proprietário do projeto foram analisados como material de planejamento, não como instruções executáveis nem documentação oficial de terceiros.

| Fonte recebida | Conteúdo aproveitado | Classificação |
|---|---|---|
| RAG, MCP e fine-tuning para o MediaMind | RAG audiovisual com timecode, Knowledge, MCP em etapas, feedback humano e fine-tuning tardio | Adaptado ao plano ativo |
| Uso de agentes e modelos locais | Separação entre IA de desenvolvimento, IA do produto, provedores externos e execução on-premises | Referência arquitetural |
| Integração OpusClip por chave/API/MCP | Mapeamento de capacidades, riscos de custo e necessidade de segredo somente no backend | Hipótese histórica, não aprovada |
| Motor próprio equivalente/superior ao OpusClip | Pipeline de vídeo, score, render, Edge/CEDOC, exportação profissional e independência de fornecedor | Consolidado nos planos ativos |

## Decisões de consolidação

1. A proposta antiga de integrar OpusClip conflita com `DECISIONS.md` e `VIDEO_AI_PROVIDER_STRATEGY.md`. Ela foi classificada como hipótese histórica rejeitada. Somente o inventário de funcionalidades permanece como benchmark; nenhuma integração, chave, API, MCP, adaptador ou dependência do OpusClip entra no plano ativo.
2. Números de preço, crédito, rate limit e capacidades de APIs citados nos textos não foram tratados como fatos atuais. Devem ser confirmados em documentação oficial antes de qualquer compra ou implementação.
3. RAG, MCP e fine-tuning foram separados porque resolvem problemas diferentes e têm riscos diferentes.
4. O MCP do MediaMind será uma fachada segura sobre serviços internos, não um caminho alternativo para o banco.
5. O uso de Ollama/Llama ou qualquer modelo local é opção de adaptador e implantação, não dependência obrigatória.
6. A interface atual do MediaMind continua sendo a experiência do usuário. Provedores e motores permanecem atrás do backend.

## Documentos atualizados ou relacionados

- `docs/ai/00_RAG_MCP_FINETUNING_MASTER.md`
- `docs/ai/01_IMPLEMENTATION_PLAN.md`
- `docs/CODEX_BACKLOG.md`
- `docs/PDF6_IMPLEMENTATION_ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/VIDEO_AI_PROVIDER_STRATEGY.md`
- `docs/MEDIAMIND_EXPORT_PACKAGE.md`

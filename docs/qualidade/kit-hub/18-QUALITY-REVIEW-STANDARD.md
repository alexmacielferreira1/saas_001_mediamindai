# 18 · Padrão de revisão de qualidade e segurança

Vale para todo SaaS do HUB, existente ou novo. Complementa o `17-TESTING-STANDARD.md`.

## Obrigatório em cada produto

1. `docs/REVISAO_QUALIDADE.md`: roteiro de auditoria (segurança, banco, arquitetura,
   frontend, confiabilidade) com formato de relatório padronizado.
2. `.claude/skills/`: skills curadas (arquitetura, depuração, entrevista de requisitos,
   Postgres/Neon, React/UI).
3. `.claude/settings.json`: plugins de segurança da Trail of Bits (`insecure-defaults`,
   `sharp-edges`, `differential-review`, `supply-chain-risk-auditor`).
4. Seção "Revisão de qualidade e segurança" no `AGENTS.md` apontando para o roteiro.
5. `CLAUDE.md` com `@AGENTS.md`: o Claude Code não lê `AGENTS.md` sozinho; sem isso ele
   ignora as regras do produto. Regras novas continuam indo para o `AGENTS.md`.
6. `.ignore` listando pastas versionadas de terceiros, temporárias ou geradas, para que as
   buscas das IAs (todas usam ripgrep) não percam tempo e contexto com elas. No MediaMind,
   isso tirou 63% dos arquivos das buscas.
7. Opcional, com aprovação manual: permissões e hooks de `proposta-config-claude/`
   (instalação automática em sessões na nuvem e formatação após cada edição).

Para aplicar a um projeto novo ou atualizar um existente:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<kit>\aplicar-kit-qualidade.ps1" -Projeto "<pasta do SaaS>"
```

O script não apaga nada nem faz commit.

## Quando auditar

| Momento | O que rodar |
|---|---|
| Antes de publicar e ao fechar marco | Roteiro completo; relatório em `docs/AUDITORIA_QUALIDADE_<data>.md` |
| Bloco que mexe em auth, permissões, dados de empresas, uploads, integrações, IA ou cobrança | `/security-review` ou `/diff-review` no diff |
| A cada 2 semanas | `/improve-codebase-architecture` nos pontos quentes; `supply-chain-risk-auditor` |
| Bug difícil | skill `diagnosing-bugs` |

## Regras comuns

- Diagnóstico não altera código; correção é um item por vez, com teste que falha antes.
- Achado sem `arquivo:linha` não conta; achados refutados são registrados.
- Achado **Crítico** (vazamento entre empresas, conta ou dinheiro) bloqueia a publicação
  até ser corrigido ou aceito por escrito em `docs/DECISIONS.md`.
- Nunca auditar ou testar contra produção ou credenciais reais.

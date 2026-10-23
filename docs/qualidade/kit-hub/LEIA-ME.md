# Kit de qualidade do HUB

Conteúdo:
- `.claude/skills/`, `.claude/settings.json`, `docs/REVISAO_QUALIDADE.md`, `AGENTS_SECAO.md`: o que vai para dentro de cada SaaS.
- `modelos/CLAUDE.md` e `modelos/.ignore`: copiados para o projeto se ainda não existirem.
- `proposta-config-claude/`: permissões e hooks do Claude Code, para você revisar e aprovar manualmente.
- `aplicar-kit-qualidade.ps1`: aplica tudo isso a qualquer projeto (novo ou existente).
- `18-QUALITY-REVIEW-STANDARD.md`: copiar para `_documentacao/standards/` do HUB.

Para a documentação do HUB:
1. Copie `18-QUALITY-REVIEW-STANDARD.md` para `_documentacao\standards\` (ajuste o número se já existir um 18).
2. Em `_documentacao\HUB_PLATFORM_STANDARD.md`, na lista de padrões obrigatórios, acrescente:
   `- Revisão de qualidade e segurança: standards/18-QUALITY-REVIEW-STANDARD.md (aplicar com aplicar-kit-qualidade.ps1).`
3. Guarde esta pasta junto do kit `PUBLICAR SAAS GRATUITO` (ex.: `PUBLICAR SAAS GRATUITO\kit-qualidade\`) e, na rotina de criação de um SaaS novo, rode o script logo depois de criar o repositório.

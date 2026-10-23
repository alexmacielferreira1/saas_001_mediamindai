
## Revisão de qualidade e segurança

- Roteiro padrão do HUB: `docs/REVISAO_QUALIDADE.md`. Rodar antes de publicar, ao fechar marco e após blocos que mexam em auth, permissões, dados de empresas, uploads, integrações, IA ou cobrança.
- Skills do projeto em `.claude/skills/`; plugins de segurança (Trail of Bits) declarados em `.claude/settings.json`. Outros agentes seguem o mesmo roteiro pelo documento.
- Relatórios de auditoria ficam em `docs/AUDITORIA_QUALIDADE_<data>.md`. Correções seguem a rotina de testes deste arquivo: teste que falha, correção, teste que passa, um item por vez.

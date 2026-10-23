# Proposta: configuração do Claude Code para os SaaS do HUB

Nada aqui está ativo. O controle de permissões não deixou o agente gravar regras de
permissão nem hooks na própria configuração, com razão: isso cabe a você aprovar.
Revise e, se concordar, copie para cada projeto:

| Arquivo desta pasta | Destino no projeto |
|---|---|
| `settings.json` | `.claude/settings.json` (substitui o que o kit colocou; já inclui os plugins de segurança) |
| `session-start.sh` | `.claude/hooks/session-start.sh` |
| `pos_edicao.py` | `.claude/hooks/pos_edicao.py` |

## O que cada parte faz

**Permissões (`permissions.allow`)**: libera sem perguntar só comandos de leitura e
verificação: pytest, ruff, lint, build, typecheck, vitest e `git status/diff/log/show`.
Menos interrupções; nada que altere dados, publique ou faça push.

**Bloqueios (`permissions.deny`)**: o agente não lê arquivos `.env` com segredos reais
(o `.env.example` continua liberado) e não faz `git push --force`.

**Hook `SessionStart`**: só em sessões na nuvem (`CLAUDE_CODE_REMOTE=true`). Cria o venv
Python 3.12, instala `requirements.lock` e o `node_modules` do frontend, para os testes
rodarem desde o primeiro minuto. Nas suas sessões locais no Windows ele sai sem fazer nada.
Roda de forma síncrona: a sessão espera a instalação terminar, o que evita o agente tentar
testar antes das dependências estarem prontas. Se preferir início mais rápido, dá para
torná-lo assíncrono.

**Hook `PostToolUse`**: depois de cada edição de arquivo `.py`, roda `ruff format` só
naquele arquivo. Mantém o gate de formatação verde sem esforço. Ele não roda
`ruff check --fix`, porque isso apagaria imports que o agente acabou de adicionar e ainda
vai usar. Se falhar, não interrompe nada.

**Plugins**: os 4 plugins de segurança da Trail of Bits, como no kit.

Validação feita aqui: o hook de sessão foi executado num clone limpo e a suíte de testes
rodou depois dele. O hook de formatação foi testado com um arquivo de exemplo.

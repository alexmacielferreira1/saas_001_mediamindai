# Histórico: sessão de qualidade, segurança e otimização para IAs (2026-10-23)

Registro completo de um chat de trabalho com o Claude Code (sessão na nuvem), para que nada se
perca ao arquivá-lo. Abrange MediaMind e Central; este arquivo descreve o MediaMind e aponta
para o equivalente na Central (`saas_000_central/docs/HISTORICO_QUALIDADE_2026-10-23.md`).

## 1. Linha do tempo

1. **Avaliação das skills do Matt Pocock** (`mattpocock/skills`, 27 skills). Veredito: boas e
   seguras (só texto e alguns scripts, sem envio de dados), focadas em processo e arquitetura,
   sem nada sobre segurança, multi-empresa, cobrança ou LGPD.
2. **Curadoria**: ficaram 6 skills do Matt; foram acrescentadas fontes oficiais de segurança
   (Trail of Bits), React/UI (Vercel), Postgres (Supabase) e Neon. Stripe ficou de fora porque o
   HUB não usa Stripe.
3. **Prompt único** de análise de SaaS e **kit do HUB** (roteiro, script, padrão 18).
4. **Auditoria** do MediaMind e da Central (somente leitura).
5. **Correções** dos críticos e altos do MediaMind com teste antes de cada correção.
6. **Otimização para IAs**: `CLAUDE.md`, `.ignore`, proposta de permissões e hooks.
7. **GitHub**: o app do Claude foi instalado nos repositórios; as branches foram publicadas.

## 2. O que foi entregue neste repositório

Branch `qualidade/kit-revisao-2026-10-23` (publicada no GitHub; PR aberto em https://github.com/alexmacielferreira1/saas_001_mediamindai/pull/17, ainda **sem merge**).

| Commit | O quê |
|---|---|
| `41c5f7a` | Kit: `.claude/skills/` (12 skills), `.claude/settings.json` (plugins Trail of Bits), `docs/REVISAO_QUALIDADE.md`, seção no `AGENTS.md`, relatório `docs/AUDITORIA_QUALIDADE_2026-10-23.md` |
| `d1c9f43` | **Crítico #1**: leitura arbitrária de arquivo via `CreativeExport.relative_path` |
| `c4f8309` | `CLAUDE.md` (importa `AGENTS.md`) e `.ignore` (tira `work/` e `tmp/` das buscas) |
| `5b8b721` | **Alto #2**: mídia confinada à pasta da empresa; `Asset.storage_key` protegido |
| `85e6f75` | **Alto #3**: bloqueio de SSRF em todas as chamadas de IA |
| `9fce0c3` | **Alto #5**: `ENVIRONMENT` obrigatório (antes o padrão era `local`) |
| `7c99e5d` | **Alto #6/#7**: conexão do banco liberada e event loop livre durante trabalho longo |
| `e4e1826` | **Alto #8**: dashboard e Gestão agregados no SQL; migração `0009` (só índice) |
| `2545ae5` | Páginas carregadas sob demanda (`React.lazy`), incluindo a nova `DarkChannels2` |
| `2732a94` | Seção "Correções aplicadas" no relatório da auditoria |
| `0ea1660` | `frontend/package-lock.json` sincronizado (o `npm ci` do CI falhava) |
| `4e11777` | Teste do rodapé do MMFilm atualizado (quebrava no `main` desde o PR #11) |
| (este)  | Este histórico e o kit do HUB em `docs/qualidade/kit-hub/` |

Os hashes citados dentro de `AUDITORIA_QUALIDADE_2026-10-23.md` (seção 7) são de antes do
rebase sobre o `main`; a tabela acima traz os hashes atuais. A observação sobre o lockfile
naquela seção está superada pelo commit `0ea1660`.

### Verificação (sobre o `main` de 2026-10-23, commit `c731714`)
- Backend: 701 testes passando (eram 666). `ruff check` e `ruff format --check` limpos.
- Frontend: 2.019 testes passando, incluindo o do MMFilm corrigido; `npm run lint` e `npm run build` OK; `npm ci` OK.
- Migração `0009`: upgrade, downgrade e upgrade conferidos num PostgreSQL 16 local.
- Bundle inicial: ~4,2 MB (1.160 kB gzip) → ~0,5 MB (153 kB gzip).
- Não verificado: carregamento sob demanda num navegador real; comportamento sob carga real.

## 3. Antes de mesclar o PR (o Render faz deploy automático do `main`)

1. **Definir `ENVIRONMENT=production` no serviço `mediamindai-backend` do Render.** Sem ela a
   API não sobe mais. Com ela, o validador de produção também exige `SESSION_COOKIE_SECURE`,
   `FRONTEND_URL` em HTTPS e `HUB_ADMIN_TOKEN`.
2. Conexões de IA cadastradas com endereço interno passam a dar 422 `AI_DESTINATION_BLOCKED`
   e precisam ser reconfiguradas.
3. `/records` passa a recusar com 422 `SERVER_OWNED_FIELD` alterações em `storage_key`,
   `sha256`, `mime_type`, `relative_path` e `size` de `Asset`/`CreativeExport`.

## 4. Decisões pendentes do Alex

- O `superadmin` deve ver e editar as conexões de IA de **todas** as empresas (`ai.py:130-143`)?
- Tornar `AI_SECRET_KEY` e `THUMBNAIL_SECRET_KEY` obrigatórias em produção?
- Aprovar a proposta de permissões e hooks do Claude Code (`docs/qualidade/kit-hub/proposta-config-claude/`).
  O controle de permissões não deixou o agente alterar a própria configuração; precisa ser você.
- Perguntas de negócio da seção 6 do relatório de auditoria.

## 5. Trabalho restante (próximas sessões)

- Achados médios e baixos ainda abertos: #9 a #14 e #16 do relatório.
- Estrutural: worker de jobs para FFmpeg/transcrição/IA (refatoração C); migração `JSON` → `JSONB`
  com índice GIN; filtros de `/records` e paginação de `admin_users` no SQL.
- Rodar o roteiro `docs/REVISAO_QUALIDADE.md` a cada 2 semanas e antes de cada publicação.

## 6. Otimização para IAs (o que mudou e por quê)

- **`CLAUDE.md`**: o Claude Code não lê `AGENTS.md` sozinho. Antes deste arquivo, as regras do
  produto não eram carregadas nas sessões do Claude. Regras novas continuam indo para o `AGENTS.md`.
- **`.ignore`**: `work/` (236 MB de cópia de terceiros) e `tmp/` saíram das buscas por ripgrep,
  usadas por Claude, Codex, Cursor e opencode: de 3.056 para 1.136 arquivos (−63%).
- **Skills** em `.claude/skills/`: `improve-codebase-architecture`, `diagnosing-bugs`, `grill-me`
  (+ dependências), `supabase-postgres-best-practices`, `neon`, `neon-postgres`,
  `vercel-react-best-practices`, `web-design-guidelines`, `composition-patterns`.
  Licenças em `.claude/skills/_licencas/`.
- **Plugins de segurança** (Trail of Bits) declarados em `.claude/settings.json`:
  `insecure-defaults`, `sharp-edges`, `differential-review`, `supply-chain-risk-auditor`.
- **Proposta (não ativa)**: liberar comandos de teste/lint, bloquear leitura de `.env` e
  `push --force`, instalar dependências automaticamente em sessões na nuvem, formatar Python após
  cada edição. Testada num clone limpo nesta sessão.

## 7. Kit do HUB (para qualquer SaaS novo)

Guardado em `docs/qualidade/kit-hub/` (cópia idêntica na Central):
- `aplicar-kit-qualidade.ps1 -Projeto "<pasta>"`: aplica skills, settings, roteiro, seção do
  `AGENTS.md`, `CLAUDE.md` e `.ignore`. Não apaga nada nem faz commit. Não foi executado nesta
  sessão (não havia PowerShell); o mesmo processo foi feito à mão nos dois repositórios.
- `18-QUALITY-REVIEW-STANDARD.md`: copiar para `_documentacao/standards/` do HUB e citar no
  `HUB_PLATFORM_STANDARD.md` (instruções em `LEIA-ME.md`). Essa pasta fica só no PC do Alex.
- `PROMPT-ANALISE-SAAS.md`: prompt único de auditoria, para usar em qualquer IA sem instalar nada.

## 8. Fontes

- Skills: github.com/mattpocock/skills (MIT), github.com/trailofbits/skills (CC BY-SA 4.0),
  github.com/vercel-labs/agent-skills (MIT), github.com/supabase/agent-skills (MIT),
  github.com/neondatabase/agent-skills (Apache-2.0), github.com/anthropics/claude-code-security-review (MIT).

## 9. Como retomar num chat novo

Cole no início:

> Leia `CLAUDE.md`, `docs/HISTORICO_QUALIDADE_2026-10-23.md` e
> `docs/AUDITORIA_QUALIDADE_2026-10-23.md`. Continue a partir da seção 5 do histórico, um item
> por vez, com teste antes de cada correção.

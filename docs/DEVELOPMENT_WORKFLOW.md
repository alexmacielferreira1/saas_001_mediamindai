# Fluxo de desenvolvimento

1. Ler o estado atual e a instrução específica na documentação do HUB.
2. Trabalhar na branch local `bootstrap/m0`; preservar o snapshot `base44-export`.
3. Preparar o ambiente com `scripts/setup.ps1`; iniciar com `scripts/dev.ps1`.
4. Fazer uma alteração delimitada, com teste adequado. Não converter várias áreas de domínio de uma vez.
5. Executar `scripts/test.ps1` e `scripts/check.ps1`; investigar falhas. Check/readiness coletam todas as verificações e retornam saída não zero se algum gate estiver falhando ou pendente.
6. Registrar estado, limitações e evidências; revisar antes de commit local. Publicação exige conta/destino definidos.
7. Parar com `scripts/stop.ps1` quando necessário. Os volumes de banco são preservados.

## Evidências

`project-status.json` e `docs/PROJECT_STATUS.md` guardam o resultado mais recente. Logs de comandos: `.runtime/checks/`. A verificação Git reflete o momento anterior à gravação do relatório; após revisar e commitar, conferir `git status` separadamente.

A verificação funcional de frontend é manual, separada de build/HTTP. Eventual aprovação fica em `manual_checks.frontend_functional_validation` no JSON, com status, updated_at e notes contendo evidência e limitações. Não aprovar enquanto erros de configuração impedirem o fluxo que se pretende validar.

## Limites

Falhas originais de lint/typecheck não foram desabilitadas. O checklist geral não substitui o catálogo completo dos requisitos. M1–M7 só avançam após os gates correspondentes. Não executar reset-db, publicar Base44, criar cloud ou limpar legado como parte de checks.

## Independência

Todos os scripts do produto funcionam sem a pasta do outro SaaS. A documentação global é uma referência humana; não há dependência de runtime sobre a raiz do HUB.

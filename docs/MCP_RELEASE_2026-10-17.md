# Publicação das correções MCP — 17/10/2026

## Escopo

- Corrigir permissões de perfis somente leitura na execução de filas e de ferramentas que geram conteúdo.
- Rejeitar identificadores de mídia inválidos em vez de ampliar silenciosamente a inspeção ao acervo.
- Distinguir ações MCP sem executor de prompts de IA e informar ações não executadas em lotes.
- Acrescentar testes independentes de MCP, cortes e políticas de consumo de IA. Os provedores são simulados nos testes; não há prova de crédito ou geração real.

## Produção antes da publicação

Workspace Render confirmado pelo proprietário: Alex. Repositório: `alexmacielferreira1/saas_001_mediamindai`, branch `main`. Em 17/10/2026, ambos os serviços apontavam para `f73b6c98de9189e8aea487461bd02f2f2028e10e`:

- Frontend `mediamindai-frontend`: deploy `dep-db98majm8hqs73fd3c2g`.
- Backend `mediamindai-backend`: deploy `dep-db98majm8hqs73fd3bs0`.

Os serviços têm deploy automático ao receber commit na `main`. A publicação parcial proposta não inclui alterações de outros chats ainda não validadas, nem mudanças de schema neste bloco; ainda depende da escolha do proprietário.

## Retorno

Se houver regressão, usar o painel Deploys do Render para voltar cada serviço ao deploy anterior acima, desde que seu artefato continue disponível; validar os serviços após o retorno. O rollback pelo painel desativa o deploy automático, que deve ser conferido e restabelecido após resolver a causa. A operação restaura o artefato da aplicação, mas não reverte banco de dados, arquivos persistentes ou efeitos externos. O comando de inicialização do backend executa migrations: conferir compatibilidade do banco antes de voltar ou republicar qualquer versão.

## Limites de validação

Na bateria iniciada às 15h30, o backend teve 353 testes aprovados e cobertura de 93,28%; os testes novos deste bloco foram acrescentados posteriormente e não integram essa medição. O frontend identificou falhas em Canais Dark, área em desenvolvimento paralelo. A bateria completa não valida a versão final dos arquivos que foram alterados durante sua execução. M0 não está aprovado. A cobertura de frontend configurada mede apenas nove arquivos, não a aplicação inteira.

Uma cópia isolada do commit de produção com os arquivos deste bloco passou em 37 testes focados de backend, 11 de MCP Express e compilação do frontend. Esses testes não comprovam a integração real com provedores nem a aprovação do conjunto completo.

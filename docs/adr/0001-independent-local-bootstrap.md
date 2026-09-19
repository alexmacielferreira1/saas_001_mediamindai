# ADR 0001 — Bootstrap independente e preservação do export

Status: adotado para M0 em 19/09/2026.

O texto-fonte pede produtos desacoplados, preservação de frontend e execução por marcos. Cada SaaS mantém Git, banco, configuração e scripts próprios. Não criar pacote compartilhado antes da validação prática.

Frontend original é copiado byte a byte e recebe tag de origem antes da base técnica. Dependências Base44 e funções simuladas permanecem explícitas. Falhas herdadas não justificam esconder checks nem redesign.

Alembic inicia o histórico sem introduzir domínio. Integração Central/SaaS, identidade, auditoria persistente e outbox aguardam os marcos seguintes. APIs M0 são locais e não compõem serviço público de produção.

Consequência: há código de bootstrap semelhante nos dois produtos, intencionalmente independente. Consolidar em starter versionado será decisão posterior.

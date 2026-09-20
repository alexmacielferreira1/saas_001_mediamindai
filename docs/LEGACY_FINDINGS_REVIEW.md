# Revisão 1B — achados da versão anterior

Fonte analisada: texto anexado em 20/09/2026 e páginas iniciais de `AJUSTAR SAAS 16092026 (3).pdf`.

Status em 20/09/2026. Esta revisão verifica a implementação local atual; não presume que um achado antigo continua válido.

## Resolvidos ou substituídos pela nova fundação

- **Autenticação e sessão:** backend local com senha scrypt, cookie opaco HttpOnly, expiração, logout e bloqueio por tentativas.
- **Multiempresa / vazamento entre empresas:** `TenantRecord`, memberships, grupos e uploads usam obrigatoriamente o tenant da sessão; o cliente não escolhe `tenant_id` no corpo.
- **Seed demo em produção:** o seed recusa qualquer ambiente diferente de `local` ou `test`.
- **Upload público:** o adaptador antigo agora grava localmente em diretório segregado por tenant e exige sessão para upload e download. URL assinada fica para a arquitetura de storage de produção.
- **Pesquisa → Workspace:** padronizado em `assetId`, mantendo leitura do parâmetro legado `asset`.
- **IDs de Asset:** o Workspace deixou de converter IDs com `Number()` e compara IDs de forma canônica como string.
- **Auditoria editável:** mutações de registros agora geram auditoria no servidor; `LogAuditoria` não aceita criação, alteração ou exclusão pelo cliente.
- **Perfil somente leitura:** `viewer` pode consultar registros do tenant, mas não pode mutá-los.
- **Base44:** SDK e plugin removidos do runtime/build; as telas existentes usam o backend local por uma camada de compatibilidade temporária.

## Ainda reproduzíveis — próximos blocos

- **Autorização por módulo/ação:** a autenticação e o tenant estão protegidos, mas rotas gerais ainda precisam de políticas granulares além do papel `viewer`.
- **Mistura mock/real:** Home, Acervo, Ingest, Workspace, Gestão e partes do Corp ainda possuem dados de demonstração ou `localStorage`.
- **Erros silenciosos:** persistências `best-effort` ainda usam `catch` sem informar falha em alguns fluxos.
- **Ingest cenográfico:** ainda existe `addMockFile`; falta conservar o `File`, progresso, checksum, retry e processamento.
- **Cortes simulados residuais:** o fluxo novo usa serviço real, mas `clipModel.js` e vídeo de amostra ainda permanecem como fallback legado.
- **Acervo e Gestão:** painéis ainda usam dados mockados em partes importantes.
- **Permissões duplicadas:** catálogo de telas do frontend e autorização do backend ainda não são uma única política.
- **Ações sem backend:** requer inventário por tela e estados explícitos de indisponibilidade/erro.

## Não aplicáveis como descritos na versão antiga

- **RLS do Base44:** não há mais Base44/RLS no runtime local. O equivalente atual é filtro obrigatório por tenant no backend; RLS PostgreSQL pode ser defesa adicional antes de produção.
- **Falha de RLS da função `transcrever_asset`:** a função Base44 antiga não é a autoridade do sistema novo. O pipeline local de processamento ainda será implementado com autorização própria.
- **Google login:** intencionalmente adiado para a fase de clientes reais; contas demo permanecem nesta fase.

## Ordem de execução mantida

1. Políticas por módulo e ação no backend e nas rotas.
2. Ingest e arquivos reais.
3. Retirar mocks dos fluxos essenciais.
4. Substituir fallbacks simulados de Cortes.
5. Aplicar as melhorias 1C do PDF em blocos com dados reais.

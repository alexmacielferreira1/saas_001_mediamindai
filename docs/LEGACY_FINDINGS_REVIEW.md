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
- **Políticas de escrita por domínio:** todos os 19 tipos mutáveis possuem política explícita no backend. Ativos/transcrições/uploads exigem `assets.write`; produção/agenda, `production.write`; revisão/aprovação, `review.write`; cortes, `clips.write`; distribuição/publicação, `publishing.write`. Auditoria permanece append-only e o seed local associa grupos por perfil.
- **Retentativa destrutiva do Ingest:** arquivos concluídos são preservados, falhas ficam identificadas e uma nova tentativa envia somente itens pendentes ou com falha. O SHA-256 calculado no servidor continua registrado no ativo.
- **Google login ausente:** o MediaMind já oferece login Google para contas locais ativas, verificadas e com vínculo ativo a uma empresa, sem criar usuários ou papéis automaticamente. Em 21/09, o callback passou a tratar cancelamento, código ausente e configuração incompleta sem erro interno; a prova no navegador publicado permanece pendente.
- **Gravações com upload falso após falha:** a seleção de pasta continua disponível, mas só arquivos confirmados pela API entram na lista de recebidos. Falhas são avisadas, arquivos confirmados são preservados e o autoavanço não ocorre com lote incompleto. A tela informa o limite atual de 100 MB por arquivo.

## Ainda reproduzíveis — próximos blocos

- **Autorização por ação fina:** a escrita já é segregada por domínio e negada por padrão. Ainda é necessário separar, quando a regra de negócio exigir, leitura, criação, edição, publicação e exclusão dentro de cada domínio.
- **Mistura mock/real:** Home, Acervo, Ingest, Workspace, Gestão e partes do Corp ainda possuem dados de demonstração ou `localStorage`.
- **Erros silenciosos:** persistências `best-effort` ainda usam `catch` sem informar falha em alguns fluxos.
- **Ingest parcialmente robustecido:** arquivo real, checksum no servidor, estado por arquivo e retomada entre arquivos já existem. Ainda faltam progresso transferido real, upload em partes/retomável, cancelamento e processamento assíncrono persistente. O envio em Gravações ainda não cria um pacote Ingest nem um Asset catalogado.
- **Cortes simulados residuais:** o fluxo novo usa serviço real, mas `clipModel.js` e vídeo de amostra ainda permanecem como fallback legado.
- **Acervo e Gestão:** painéis ainda usam dados mockados em partes importantes.
- **Permissões duplicadas:** catálogo de telas do frontend e autorização do backend ainda não são uma única política.
- **Ações sem backend:** requer inventário por tela e estados explícitos de indisponibilidade/erro.

## Não aplicáveis como descritos na versão antiga

- **RLS do Base44:** não há mais Base44/RLS no runtime local. O equivalente atual é filtro obrigatório por tenant no backend; RLS PostgreSQL pode ser defesa adicional antes de produção.
- **Falha de RLS da função `transcrever_asset`:** a função Base44 antiga não é a autoridade do sistema novo. O pipeline local de processamento ainda será implementado com autorização própria.

## Ordem de execução mantida

1. Evoluir o Ingest atual para upload em partes, retomada e processamento persistente.
2. Refinar as políticas por ação dentro de cada domínio conforme as jornadas reais forem conectadas ao backend.
3. Retirar mocks dos fluxos essenciais.
4. Substituir fallbacks simulados de Cortes.
5. Aplicar as melhorias 1C do PDF em blocos com dados reais.

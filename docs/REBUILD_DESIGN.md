# Reconstrução local do MediaMind no HUB

## Objetivo

Remover o Base44 do caminho de execução do MediaMind sem redesenhar a interface. O export, a tag `base44-export`, os schemas JSONC e as funções originais permanecem como referência de paridade. O produto final roda localmente com React/Vite, FastAPI, PostgreSQL e storage próprio, e continua funcional com a Central desligada.

## Limites do HUB

- Cada SaaS mantém repositório, banco lógico, migrations, storage, configuração, versão e ciclo de recuperação próprios.
- A Central é plano de controle e nunca participa do caminho crítico do domínio.
- Identidade, tenancy, erros, correlação, auditoria, jobs, storage e contratos administrativos seguem padrões comuns, mas começam implementados dentro do MediaMind.
- Um pacote compartilhado só nasce após a mesma abstração ser comprovada em MediaMind e Central.
- O Detachment Test é obrigatório: desligar ou retirar a Central não pode impedir login local nem operações essenciais.

## Estratégia de migração

Migração por estrangulamento, reversível e verificável:

1. congelar e inventariar contratos Base44;
2. introduzir contratos HTTP locais sem alterar o layout;
3. implementar uma fatia vertical no FastAPI e PostgreSQL;
4. trocar somente os consumidores dessa fatia;
5. provar testes, persistência e navegação;
6. repetir até não haver imports nem configuração Base44 no runtime;
7. manter o material Base44 apenas em `frontend/base44`, documentação histórica e tag.

Não haverá um adaptador genérico que replique indefinidamente a API do SDK. A camada transitória só existe para preservar o frontend enquanto endpoints explícitos substituem entidades, funções, upload e autenticação.

## Arquitetura alvo

### Frontend

- `src/api/httpClient.js`: transporte HTTP, correlação e erros públicos.
- `src/api/auth.js`: sessão local.
- `src/api/<capacidade>.js`: clientes explícitos por capacidade.
- contextos React guardam estado de sessão e seleção; o servidor é fonte de verdade.
- nenhuma senha, token de serviço ou acesso direto ao banco no bundle.
- JSX, rotas, estilos e componentes visuais existentes são preservados salvo correção comprovada.

### Backend

- `/api/v1`: autenticação, empresas, usuários e domínio MediaMind.
- `/admin-api/v1`: health, version, capabilities e readiness para a Central, somente em M2.
- módulos separados por capacidade com router, schema, service, repository e models focados.
- tenant derivado da sessão; IDs de tenant enviados pelo navegador nunca são confiados isoladamente.
- erros usam o envelope estruturado e IDs de correlação já existentes.

### Dados e arquivos

- PostgreSQL local é a fonte de verdade de metadados.
- migrations Alembic são aditivas e possuem downgrade enquanto a migração estiver em curso.
- arquivos usam `StorageProvider`; inicialmente filesystem local com diretório próprio e referências no banco.
- seeds de demonstração são explícitos, idempotentes e nunca se confundem com dados reais.

## Ordem das fatias

1. Fundação: sessão local, usuário, empresa, membership e RBAC.
2. Projetos, bibliotecas e assets/acervo.
3. Upload e pacotes de ingest, com jobs persistentes.
4. Workspace, direitos, transcrição, revisão e timeline.
5. Roteiros, mídias associadas e produção.
6. clipes, versões, aprovação e publicação.
7. agenda, tarefas, saved searches, atividade e módulos Corp.
8. auditoria, gestão, relatórios e operações.
9. funções de IA atrás de providers configuráveis; ausência de fornecedor produz estado indisponível explícito, não resposta falsa.
10. Admin API, outbox e conexão tolerante a falhas com a Central.

## Autenticação inicial

A primeira entrega usa contas locais, senha armazenada apenas como hash forte, cookie de sessão `HttpOnly`, `SameSite=Lax` e expiração no servidor. Os usuários de demonstração existentes serão semeados no backend somente em ambiente local/teste; `alexmacielferreira@gmail.com` é o superadmin e os demais e-mails/papéis permanecem os exibidos pelo produto. A senha vem de configuração local não versionada. O processo deve recusar seeds demo em produção.

Quando houver clientes reais, a prioridade será autenticação pelo Google. E-mail corporativo e contas convidadas/cadastradas pelo RH ou por administrador serão alternativas controladas, com convite por e-mail e vínculo explícito a empresa e papel. Essa federação não será antecipada durante a reconstrução local; o modelo de usuário, membership e tenant deve permitir acrescentá-la sem alterar o layout ou misturar identidades reais com contas demo. MFA e identidade global pertencem à mesma evolução posterior.

## Compatibilidade e remoção

Durante a transição, páginas ainda não migradas permanecem em modo de demonstração claramente identificado ou bloqueadas com mensagem acionável. Uma capacidade só perde seu fallback depois de provar leitura, escrita, isolamento, autorização, auditoria e regressão. A contração final remove `@base44/sdk`, plugin Vite, `src/api/base44Client.js`, parâmetros Base44 e imports de runtime; os artefatos históricos ficam preservados.

## Verificação

- backend: testes unitários, API, autorização e PostgreSQL real;
- frontend: testes dos clientes/contextos, lint, typecheck e build;
- contrato: códigos, schemas e erros entre React e FastAPI;
- navegação: rotas, refresh de sessão, troca de empresa, permitido/negado e estados vazios;
- paridade: matriz por tela e jornada com referência ao export;
- independência: suíte essencial com a Central parada.

## Fora deste primeiro ciclo

Cloud, GitHub, produção, domínio, Render/Neon, pacote compartilhado e limpeza de volumes não entram antes da reconstrução local verificada. A limpeza Docker será uma fase final separada, com inventário e preservação explícita da porta 8001 e de dados não classificados.

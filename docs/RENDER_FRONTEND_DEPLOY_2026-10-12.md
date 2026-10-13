# Publicação pontual do frontend — 12/10/2026

Autorização explícita de Alex: atualizar online o frontend no serviço indicado na aba Render. Serviço confirmado: `mediamindai-frontend`, `srv-daokabijnfac739ae550`, https://mediamindai-frontend.onrender.com. Não inclui alteração do backend, banco ou secrets.

Falha histórica confirmada: deploy do commit `192289e` em 09/10 não encontrou `/src/main.jsx`. `git show 192289e:frontend/src/main.jsx` confirma ausência no commit. O arquivo está versionado no commit `a5de4677cc34e455471770902c5e3051c6188bec`.

Cópia limpa extraída somente do frontend desse commit em `.runtime/deploy-check-a5de467`. `npm ci` e `npm run build` aprovados. Alertas de dependências (20 vulnerabilidades reportadas pelo npm), tamanho de bundle e importação dinâmica não são corrigidos por esta publicação. Não declarar segurança integral.

Render mantido com root `frontend`, build `npm ci && npm run build`, publish `dist`, branch `main`. Publicação manual de commit específico de outra branch: `a5de467`. O próprio Render desativa Auto-Deploy para evitar que a main antiga substitua o commit pontual. Não reativar sem consolidar a branch/release apropriada.

Deploy iniciado: `dep-db6n507avr4c73ct3vng`. Versão anterior disponível para rollback: `48a8f4a9d2f847fc818a99eb158fc42fe4cbcc1f`, deploy `dep-db437h6q1p3s739kpif0`. Não alterar dados ao reverter frontend. Gates gerais e backend permanecem pendentes; publicação estática não comprova compatibilidade funcional de todos os endpoints novos.

Resultado confirmado: **Deploy succeeded | Live**, commit `a5de467`, iniciado às 20:51:28 de 12/10/2026 (São Paulo), duração 38,7 s. URL pública aberta e login novo carregado, com link Google apontando ao backend público existente. Não executar login de produção nem inserir credenciais para esta checagem. Screenshot local: `.runtime/render-published-2026-10-12.png`. A versão inclui somente alterações até esse commit; trabalho ainda não commitado de outros chats permanece local.

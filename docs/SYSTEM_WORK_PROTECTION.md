# Proteção de trabalhos no MediaMind — 12/10/2026

Pedido de Alex: estender o salvamento automático e a recuperação das ferramentas gráficas ao restante do sistema. Esta fatia instala uma base compartilhada no Shell e conecta explicitamente estados de conteúdo dos editores. Não é backup completo do servidor nem garantia de todos os campos de todos os formulários.

## Cobertura implementada

- Workspace e Workspace 2: projeto, itens e blocos do roteiro; falha no acervo deixa de substituir blocos recuperados por exemplos.
- Roteiro 2: formulário do roteiro não salvo, conservado após falha de salvamento.
- Timeline e Timeline 2: itens/documento, histórico, texto e marcadores; o armazenamento de compatibilidade da Timeline recebe escopo por empresa/usuário/projeto.
- Artes e thumbnails: trabalhos abertos, documento, perfil, tema, camadas e formatos. Templates iniciais não substituem documento recuperado.
- Estúdios de IA: briefings, prompts, texto, cenas, segmentos, referências e imagens. Geradores diferentes usam chaves diferentes.
- Assistente: histórico de conversa e texto ainda não enviado.
- Agenda: rascunho por evento; CG: texto/configuração por clipe.
- Ingest: nome, pasta, programa, arquivos, áudio e etapa antes do envio; arquivos de recuperação preservam nome e tipo de File.
- Office: documento, células e slides. Mesa integrada SoundCraft: faixas. Armazenamento legado destas interfaces recebe escopo por empresa/usuário/projeto.
- Ferramentas gráficas: implementação anterior permanece em provider próprio, evitando duplicação de salvamento.

## Comportamento e isolamento

O provider restaura os dados antes de montar o editor. Cada área possui namespace de empresa, usuário, caminho e projeto. Estados de recursos variáveis usam IDs próprios quando necessário. Troca de chave do mesmo componente recupera o estado correto sem transferir uma edição do recurso anterior. Autosave em IndexedDB conserva snapshot atual e anterior em transação. Um arquivo inválido não substitui o estado atual; recuperação identificada de outra área/empresa/usuário é recusada. O arquivo exportado contém também as mídias necessárias.

Não armazenar senhas, API keys, access/refresh tokens, encrypted keys ou secrets no arquivo: o arquivador omite esses campos em objetos. Telas de configuração de IA e administração não usam o provider automático; credenciais continuam nos fluxos existentes do servidor. Textos livres podem conter informações sensíveis fornecidas pelo usuário; tratar o arquivo de recuperação como conteúdo da empresa, não como arquivo público.

Estados já confirmados no servidor continuam sob responsabilidade da API. O rascunho local não simula salvamento oficial e não substitui autorização, auditoria ou persistência do servidor. O indicador diz explicitamente “neste navegador”.

## Limites e próxima auditoria

Não foi comprovada cobertura integral de todos os modais administrativos, entidades e integrações externas. O SoundCraft WASM em iframe possui armazenamento próprio e não foi adaptado; somente a mesa integrada está conectada. Preservar os salvos antigos do localStorage: não foram apagados nem atribuídos automaticamente a outras empresas. Uma varredura campo a campo ainda precisa identificar formulários sem hook, editores que carregam campos do servidor sobre drafts e fluxos que usam stores externos. Backups do banco/storage, sincronização entre dispositivos e conflitos entre abas exigem implementação própria.

Ao limpar os dados do navegador, rascunhos locais podem desaparecer. Baixar recuperação fornece uma cópia independente; fechamento abrupto durante gravação pode perder mudanças recentes. O aviso de saída reduz esse risco, mas não promete durabilidade de hardware.

## Evidências e rollback

Testes da camada compartilhada cobrem remontagem, isolamento, mídia, cópia anterior, importação inválida, alternância de recursos e omissão de credenciais. Testes existentes de Workspace, roteiros, estúdios, thumbnails, timelines e Office/áudio foram exercitados após ligação dos hooks. Lint, tipos e build verificados. Registrar o resultado final da suíte antes de enviar alterações.

Rollback: reverter o commit da fatia no repositório, mantendo IndexedDB e arquivos exportados. Remover provider/hooks volta ao comportamento anterior; não remover dados como parte da reversão. Produção continua sujeita aos gates gerais M0 registrados.

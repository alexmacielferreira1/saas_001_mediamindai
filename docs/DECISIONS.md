# Decisões específicas do MediaMind

- O Workspace original permanece; Workspace 2 evolui isoladamente até paridade comprovada.
- Contas demo permanecem apenas no ambiente local/teste; produção real usa contas cadastradas.
- Google OAuth não cria usuário, tenant ou papel automaticamente.
- Timeline, roteiro, cortes, acervo audiovisual e workflow editorial são domínio do MediaMind, não serviços genéricos do HUB.
- Mudança no backend publicada não pode invalidar memberships existentes; migrations/bootstrap devem preparar permissões antes do enforcement.
- **Decisão definitiva sobre OpusClip:** usar somente como benchmark de funcionalidades, fluxos e critérios de qualidade. Não integrar API ou MCP do OpusClip, não cadastrar chave, não criar adaptador, não persistir IDs externos e não depender dele para processamento. O destino é o Clip Engine próprio do MediaMind; transcrição, compreensão multimodal, embeddings e visão computacional entram como componentes substituíveis por contratos neutros, sem transferir o algoritmo editorial, o score ou a timeline para terceiros.
- A sequência de inteligência é RAG audiovisual e Knowledge primeiro, MCP de leitura depois de APIs internas estáveis, ações MCP somente com autorização/auditoria e fine-tuning apenas após dataset real e avaliação reproduzível.
- O MCP do MediaMind não acessa o banco diretamente e nunca amplia as permissões do usuário representado.
- Modelos locais, on-premises e externos são opções atrás de contratos neutros; nenhum agente ou modelo específico se torna requisito estrutural.

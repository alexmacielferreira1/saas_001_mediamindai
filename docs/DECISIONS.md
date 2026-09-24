# Decisões específicas do MediaMind

- O Workspace original permanece; Workspace 2 evolui isoladamente até paridade comprovada.
- Contas demo permanecem apenas no ambiente local/teste; produção real usa contas cadastradas.
- Google OAuth não cria usuário, tenant ou papel automaticamente.
- Timeline, roteiro, cortes, acervo audiovisual e workflow editorial são domínio do MediaMind, não serviços genéricos do HUB.
- Mudança no backend publicada não pode invalidar memberships existentes; migrations/bootstrap devem preparar permissões antes do enforcement.
- OpusClip é referência funcional, não fornecedor do produto. O Clip Engine será nativo do MediaMind; modelos de transcrição, compreensão multimodal e visão computacional podem variar por adaptadores neutros sem transferir o algoritmo editorial ou a timeline para terceiros.

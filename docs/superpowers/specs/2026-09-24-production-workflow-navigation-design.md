# Fluxo editorial e navegação consolidada do MediaMind

Data: 24/09/2026

## Objetivo

Transformar as telas de produção hoje fragmentadas em um fluxo editorial coerente, rastreável e operável por drag-and-drop e ações explícitas, preservando as versões antigas por URL para conferência. O Workspace 2 passa a ser a área principal de pesquisa, roteiro e montagem. A identidade visual atual é preservada e normalizada, sem redesign geral.

## Fluxo canônico

O conteúdo segue, por padrão, esta sequência:

1. Rascunhos
2. Agendamentos
3. Gravações
4. Material para editar
5. Em edição
6. Aguardando aprovação
7. Em aprovação
8. Finalizado
9. Redes sociais
10. Para publicação
11. Publicado
12. Analytics

Cada etapa tem identificador estável independente do rótulo exibido. Transições normais avançam ou retornam uma etapa. Saltos exigem ação explícita e justificativa quando forem futuramente permitidos. Analytics não é uma fila editável: exibe somente itens publicados e métricas associadas.

## Interação das filas

- Cartões podem ser arrastados para uma coluna vizinha quando as colunas estiverem na mesma tela.
- Nas telas de fila única, zonas fixas nas bordas esquerda e direita aparecem durante o arraste. A esquerda representa a etapa anterior; a direita, a próxima.
- Todo cartão também possui ação acessível equivalente: `Voltar para …`, `Enviar para …` ou `Abrir detalhes`.
- O drop mostra destino antes da soltura, impede destino inválido e exibe confirmação visual após persistência.
- Falhas restauram o cartão à posição anterior e mostram mensagem compreensível.
- Teclado e leitores de tela recebem ações equivalentes; drag-and-drop não é o único meio de operar o fluxo.
- A tela Redes sociais mantém sua estrutura interna de cortes, formatos e plataformas. A transição para Para publicação ocorre apenas depois que o pacote social estiver preparado.

## Estado e persistência

Um catálogo único define ordem, rótulos, rotas, etapa anterior e próxima etapa. O `producaoStore` continua como adaptador temporário do frontend atual, mas todas as telas passam a usar o mesmo catálogo e a mesma função de transição. O contrato deverá ser compatível com persistência posterior via API, sem espalhar strings de status nos componentes.

Os estados antigos serão mapeados para o novo catálogo na leitura. Nenhum registro será descartado. Estados desconhecidos permanecem visíveis como `Revisar classificação` e não avançam automaticamente.

## Navegação

O menu lateral de Produção passa a mostrar somente o caminho operacional principal:

- Visão geral
- Ingest
- Workspace 2
- Rascunhos
- Agendamentos
- Gravações
- Material para editar
- Em edição
- Aguardando aprovação
- Em aprovação
- Finalizado
- Redes sociais
- Para publicação
- Publicado
- Analytics

Saem do menu lateral, sem remoção das rotas ou componentes antigos:

- Pesquisa
- Workspace
- Modo roteiro
- IAcervo Corp

Pesquisa e o novo Modo roteiro ficam integrados ao Workspace 2. Workspace e Modo roteiro antigos permanecem acessíveis somente por URL documentada durante a conferência de paridade.

## Perfis

A página atualmente chamada IAcervo Corp passa a ser apresentada ao superadmin por um botão `Perfis` no Início. O botão abre a visão dos papéis existentes para que o superadmin possa conferir a experiência e o estado de cada perfil. A rota antiga `/corp` permanece compatível; apenas seu papel na navegação muda.

Usuários sem permissão administrativa não veem o botão Perfis. A autorização real continua no backend; ocultar o botão não substitui controle de acesso.

## Workspace 2

O Workspace 2 torna-se a superfície principal e recebe:

- pesquisa de acervo e filtros úteis;
- seleção e prévia de mídia;
- roteiro no padrão novo já presente no Workspace 2;
- montagem/timeline e ações existentes;
- links de referência para as telas antigas apenas durante a fase de conferência.

As implementações antigas não serão apagadas nesta etapa. Depois da validação funcional, será produzido um inventário do que ainda existe somente nelas.

## Consistência visual e comportamento

- Painéis, campos, botões, modais e cartões usam o mesmo raio, borda, espaçamento e estados de foco.
- Elementos que parecem clicáveis precisam executar ação, abrir detalhe ou ficar visualmente desabilitados com explicação.
- Botões icon-only recebem nome acessível e tooltip.
- Toda lista tem estados de carregamento, vazio, erro e sucesso.
- Detalhes de cartões mostram etapa atual, responsável, histórico e próxima ação.
- O menu mantém hierarquia compacta e indicação clara da tela ativa.

## Produção e contas demo

O acesso rápido por papel deve existir apenas em ambiente local autorizado. Em produção, os cartões demo não são renderizados e a API deve continuar recusando o endpoint demo. Esta correção é independente do fluxo editorial, mas é bloqueadora para considerar a interface publicada segura.

## Verificação

1. Testes unitários do catálogo e de todas as transições válidas/inválidas.
2. Testes de componentes para ações anterior/próxima, falha e acessibilidade.
3. Testes do menu por papel, incluindo botão Perfis do superadmin.
4. Testes do Workspace 2 para Pesquisa e Roteiro integrados.
5. Build, lint, typecheck e suíte frontend.
6. Auditoria no navegador em desktop e largura móvel.
7. Homologação local antes de qualquer push ou deploy.

## Fora desta etapa

- Publicação automática em redes externas.
- Redesign completo do MediaMind.
- Remoção definitiva das telas antigas.
- Deploy sem autorização explícita.
- Alteração de segredos ou dados reais de produção.

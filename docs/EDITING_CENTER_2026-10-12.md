# Central de edição — implementação local

Seletor refinado: barra entre os quatro indicadores e a timeline. Lista contém só entregas da etapa selecionada, inclusive Aguardando revisão. Etapa vazia não mantém timeline de outra fila. Criar entrega seleciona Para editar. Indicadores de outras filas não contam entregas em revisão como Para editar.

Refinamento solicitado às 21h de 12/10: cabeçalho, Nova edição e indicadores/menus superiores permanecem visíveis. Fila e detalhes abrem para baixo por botão com aria-expanded, recolhidos inicialmente. Seleção de entrega em uma linha. Abaixo fica o mesmo FilmCraftWorkspace usado na aba **MMFilm · prévia** do Workspace, isolado por empresa/usuário/entrega com recuperação. Não apagar drafts da Timeline2 anterior nem migrá-los implicitamente. Esse editor ainda é independente do fluxo de exportação da Timeline2; salvar/exportar o projeto MMFilm é um fluxo próprio.

Publicação solicitada em 12/10: enviar a fatia para `update/creative-studios-2026-10-11`, sem merge/deploy de produção. Último relatório completo: frontend 495 testes / 101 arquivos aprovados; backend 231 testes aprovados, mas gate de cobertura 94,24% versus 100% e 21 erros de qualidade. Não declarar publicação online aprovada. Solicitação adicional de usar a timeline de prévia do Workspace nas três filas ainda pendente de implementação; o código atual incorpora Timeline2 completa.

Origem: três imagens fornecidas por Alex da Central de edição (Para editar, Em edição, Em alteração), em `C:/Users/Alex/Desktop/para editar/`, e pedido de players reais em 12/10/2026.

Fila à esquerda com ordenação, painel de produção, checklist explícito, prévia de mídia real, abas Timeline/Mídias/Documentos/Referências/Observações. Timeline2 existente incorporada em largura inteira e namespace de entrega. Não criar barras fixas como se fossem clips.

Player compartilhado usa eventos do HTMLMediaElement para reprodução, pausa, tempo, duração, mute e seek; erro ou ausência de arquivo não simulam reprodução. Marcadores saltam ao tempo real. Tela de revisão deixa de avançar um relógio fictício e reproduz o vídeo recebido mantendo anotações sobre o frame.

Versões e apontamentos da nova Central são **rascunhos locais** protegidos pelo provider do sistema, não entregas publicadas. Enviar nova versão conserva as anteriores e seleciona o arquivo real. Status dos apontamentos é editável; comentários são vinculados à versão. Mídias sem URL indicam indisponibilidade. Histórico fictício de versões removido da Central.

Limites: não representa auditoria concluída de todos os players. Conferência da aprovação ainda contém painéis históricos de exemplo fora do transporte corrigido. Integração dos apontamentos existentes do fluxo de aprovação com a nova Central e publicação durável das versões precisam de uma fatia própria. Não prometer equivalência completa ao After Effects nem fidelidade pixel a pixel. Testes de transporte usam mídia controlada no DOM; reprodução audiovisual ponta a ponta no navegador requer arquivo real e ainda deve ser conferida.

Rollback: reverter somente arquivos desta fatia; preservar IndexedDB, mídias e arquivos de recuperação. Não publicar em produção enquanto gates gerais estiverem pendentes.

Correção comprovada de persistência: o adaptador ProducaoProjeto descartava materiais, edicao_status, edicao_obs e prazo_edicao em load/save. Esses campos agora são conservados; teste de round-trip com fonte de mídia real e observação alterada aprovado. ClipPlayer deixa de mostrar programa fictício quando sem mídia, desabilita Play e pausa ao ultrapassar OUT, mesmo se o evento de tempo saltar mais de 400 ms. A ação que copiava nomes foi renomeada para não alegar download.

Validação focada: MediaPlayer (2), Central (4), painéis da entrega (2), revisão (7), cortes (2), store (3) e Timeline2 (8): 28 casos aprovados em execuções focadas. Lint, typecheck e build aprovados. Preview local inspecionado na Central; sem mídia na entrega selecionada, Play aparece desabilitado corretamente. Suíte combinada iniciada em 12/10/2026 às 15:36; não interpretar resultados parciais como aprovação geral.

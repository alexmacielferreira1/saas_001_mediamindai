# Continuidade integral do chat — MediaMind AI + AI Edita

Data de consolidação: 27/09/2026.

Este documento preserva os pedidos funcionais feitos ao longo do chat para que a implementação continue sem depender do histórico da conversa. Ele é uma fonte de requisitos subordinada ao `AGENTS.md` e aos padrões do HUB. Menções a “copiar” o AI Edita significam reproduzir comportamento útil dentro da arquitetura, identidade, permissões e domínio do MediaMind — não copiar marca, dados, segredos ou runtime.

## Princípios mandatórios

- preservar → comparar → melhorar;
- usar `001_mediamindai` como fonte atual; não voltar ao ZIP por cima de trabalho mais novo;
- preservar a base nova/Emergent, o Workspace original e toda funcionalidade boa existente;
- evoluir principalmente o Workspace 2 e integrar a Timeline 2 nele;
- não redesenhar drasticamente a estrutura visual; adicionar/compactar/reorganizar somente para melhorar uso;
- todo controle habilitado deve executar ação observável; protótipo somente quando explicitamente solicitado e identificado;
- uploads, players, arrastes, filas, exportações e transições devem funcionar de ponta a ponta, não apenas mostrar mensagem;
- IA pode permanecer indisponível até existir configuração real, mas o restante do fluxo deve funcionar sem sucesso falso;
- distinguir sempre: visual, funcional local, backend real, persistido, homologado e produção;
- meta local pedida: mínimo de 90% dos controles habilitados funcionando; produção exige os gates do HUB;
- não publicar em GitHub/Render/Neon sem autorização explícita.

## Fontes que precisam continuar sendo confrontadas

- projeto atual `C:\Users\Alex\Desktop\HUB_SAAS\001_mediamindai`;
- `001_mediamindai.zip`, somente como fotografia/referência anterior;
- `AI-Edita-Windows-x64.zip` e a aplicação local em `http://127.0.0.1:3000/`;
- `AI-Edita-Legendas-Pro-v2.aiedita`;
- `26-20260926T174356Z-1-001.zip`;
- `Saas atualização 14092026.pdf`;
- `AJUSTAR SAAS 16092026.pdf`;
- textos e imagens anexados no chat;
- documentação vigente do HUB e do MediaMind.

## Workspace 2 — fluxo correto

1. Manter `Pesquisa → Roteiro → Prévia → Timeline → Exportação`.
2. No Passo 3, preservar todos os recursos existentes e colocar na última coluna o resumo “Pronto para Timeline”, com mídias, blocos, trilhas e duração reais.
3. O botão `Abrir Timeline` do Passo 3 abre diretamente o Passo 4.
4. Passo 4 é a Timeline 2 completa dentro do mesmo cabeçalho/Workspace; não é página intermediária nem item separado obrigatório no menu.
5. Timeline deve abrir montada com mídias, ordem, roteiro, blocos, trilhas e configurações dos passos anteriores.
6. Passo 5 centraliza player final, salvamento, intercâmbio, render, fila, aprovação, lote e download.
7. No Roteiro, todos os itens da lista precisam ser selecionáveis; incluir busca rápida que mantém os parâmetros da Pesquisa e drag-and-drop de mídia para blocos.
8. Na Prévia, ativar Projeto/Biblioteca IA quando houver backend real e fazer todos os botões existentes funcionarem.

## Timeline/editor — comportamento exigido

- upload local real e inclusão a partir do Acervo;
- mídia enviada localmente também entra no Acervo;
- seleção simples e múltipla, seleção por caixa e propriedades do elemento selecionado;
- arrastar clipes horizontalmente e entre trilhas; criar trilha compatível acima/abaixo quando necessário;
- regras de empilhamento: áudio abaixo de vídeo; texto acima de vídeo; legenda acima de texto;
- trilhas de vídeo, áudio, texto, grafismo, captions e música, com adicionar/remover/reordenar, lock, mute e visibilidade;
- agulha/playhead por clique e arraste na régua e nas faixas, sem exceção de ponteiro, inclusive depois de zoom/rerender;
- relógio contínuo em lacunas: quadro preto e silêncio até o próximo clipe;
- trim não destrutivo, split/lâmina, ripple delete/insert, duplicar, excluir, copiar/colar e snapping;
- zoom temporal, régua legível, timecode compacto/SMPTE, IN/OUT, marcadores e capítulos;
- undo/redo e histórico de comandos;
- atalhos profissionais: Space, J/K/L, I/O, S, Delete, setas, Home/End, undo/redo e configuração futura;
- preview multicamada sincronizado e áudio original representado/separável em trilha própria;
- waveform real, ganho, volume, mute, fade, mixagem, speed/retime e stretch;
- texto e legenda entram com Enter;
- legendas sincronizadas, edição por palavra, tradução, karaoke, estilos e importação dos 32 presets `.aiedita`;
- biblioteca de efeitos/transições inspirada em necessidades cobertas por Premiere, DaVinci e CapCut, mas implementada/renderizada de verdade;
- guias e formatos 16:9, 9:16, 1:1, 4:5 e safe areas;
- nenhum ícone/ferramenta meramente cenográfico.

### Inspetor

- posição X/Y, escala X/Y ou uniforme, rotação, âncora, crop, opacidade e composição;
- velocidade/retime, volume e propriedades específicas por tipo;
- keyframes por propriedade, auto-keyframe, anterior/próximo e remover;
- curvas hold, linear, suave/ease e Bézier; graph editor avançado como evolução rastreada;
- efeitos, cor e áudio em grupos claros, mantendo o painel lateral atual;
- alterações devem refletir no preview e no render/exportação.

### Defeitos P0 abertos no último teste

- `MM-TL-NEEDLE-003`: agulha ainda gera erro no uso real;
- `MM-PLAYER-GAP-001`: lacuna deve continuar a sequência em preto/silêncio;
- arraste/aparo precisam ser exercitados manualmente como usuário após qualquer mudança de gesto.

## Passo 5 — salvar, exportar e fila

- salvar projeto dentro do MediaMind e permitir exportar arquivo de projeto;
- exportar clipe individual agora, enviar para fila ou manter versão no sistema para aprovação/download posterior;
- exportar sequência/timeline completa e deixar clara a diferença para clipe individual;
- exportar para edição externa: Premiere/DaVinci primeiro, depois Final Cut/Avid/genérico;
- formatos/artefatos: XML, EDL, OpenTimelineIO, PDF com marcações e sidecars pertinentes;
- pacote profissional com frame rate preciso, áudio separado, relink, handles, mídia referenciada/consolidada, legendas SRT/VTT/TTML/iTT/ASS, checksums e validação;
- player final funcional no Passo 5, respeitando IN/OUT e lacunas;
- opção de render imediato, somente fila, fila + processar e versão para aprovação;
- fila durável com estados `queued → preparing → rendering_optional_assets → packaging → validating → ready/failed`, progresso, retry e cancelamento;
- não chamar fila em `localStorage` de fila de produção.

## Conteúdos, Edição, projetos e lote

- verificar duplicidade entre `Material para editar` e `Em edição`; consolidar o menu em `Edição`, preservando estados internos necessários;
- `Edição` deve manter histórico de projetos/timelines que podem continuar, baixar ou editar externamente;
- criar página/área `Editar com IA`: subir vídeos (indo para o Acervo), escolher do Acervo, selecionar vários, recentes e projetos em andamento;
- edição em lote com mesma configuração para vários arquivos: legenda, remoção de pausas, cortes, textos/arte, formato, render, aprovação e publicação;
- exportações manuais também podem entrar na mesma fila;
- prompts editáveis e ações prontas equivalentes às capacidades úteis da Hanna, sem criar outro nome/personagem de IA;
- prompts devem cobrir edição contextual, vídeos finais/publicações, insights e situação da produção;
- IA do site deve compartilhar capacidades autorizadas, provider configurável, custos/créditos, quotas e auditoria.

## Ingest e Acervo

- pacote de Ingest pode ficar sem nome; usuário renomeia depois;
- corrigir envio interrompido e retomada, preservando arquivos concluídos;
- upload deve aparecer no Acervo e nas telas operacionais pertinentes;
- permitir testes locais em pasta controlada até o storage/banco de vídeo ser designado;
- Acervo deve usar painel lateral para detalhes/edição em vez de modal que perde contexto;
- operações em lote: mover, tags, categoria, indexar, reprocessar IA, exportar metadados, baixar e arquivar;
- duplicidade por checksum/fingerprint; exclusão restrita e auditável;
- ações “puxar para editar”, atribuir, registrar download/conclusão devem mudar estado real.

## Esteira editorial e aprovação

Ordem canônica a preservar: `rascunho → agendamentos → gravacoes → para_editar → em_edicao → aguardando_aprovacao → em_aprovacao → finalizado → redes_sociais → para_publicar → publicacoes → analytics`.

- item pertence a uma etapa por vez e deve desaparecer da origem ao avançar;
- Rascunhos mostra somente rascunhos;
- confirmar agendamento cria/atualiza Gravação visível;
- `Em edição` substitui o menu duplicado, mas conserva os subestados úteis;
- enviar para aprovação leva a `aguardando_aprovacao`;
- `aguardando_aprovacao → em_aprovacao` precisa funcionar e persistir (`MM-FLOW-AP-003`);
- solicitar alterações retorna a `em_edicao`;
- aprovação com alterações abertas exige confirmação;
- Finalizado oferece ações coerentes para cortes, publicação e agendamento;
- histórico e auditoria das transições; persistência após reload.

## Players compartilhados

- a base funcional da Timeline deve virar componente reutilizável para Pesquisa, Revisão/Aprovação, Finalizado, Para publicação e Publicado;
- play/pause, seek, mute/volume, IN/OUT, frame stepping, SMPTE, marcadores, comentários, capítulos, thumbnails e waveform quando derivados reais existirem;
- não usar um card visual como substituto de vídeo reproduzível;
- estado vazio, arquivo incompatível, proxy ausente e falha precisam ser explícitos.

## Publicação, redes e Analytics

- `Adicionar canal` abre seleção/configuração do canal; ícones corretos por rede;
- permitir editar e salvar dados de `Para publicação`;
- filtros por canal, formato, período, tipo de vídeo e conteúdo;
- layouts de Para publicação/Publicados seguem o padrão arredondado do MediaMind;
- botões de agendar/publicar/transicionar precisam de ação e persistência reais;
- Analytics deve reduzir poluição com filtros e revelação progressiva;
- publicação real precisa de credenciais seguras, jobs idempotentes, permissões e auditoria.

## Administração, Gestão e IA

- incorporar Configurações do AI Edita no domínio administrativo do MediaMind, não como produto paralelo;
- configurações da empresa e, para superadmin, configurações globais/Central conforme autorização;
- provedores de IA configuráveis (OpenAI e futuros), modelo, limites/créditos e testes de conexão, sem expor secrets;
- Gestão, relatórios e Acervo devem permitir edição compatível com permissões;
- tema claro/escuro, atalhos, botões e menus adicionais podem ser incorporados sem descaracterizar a identidade.

## UX e dados complementares

- convidados de programas devem ter sugestões predefinidas com nome e cargo, selecionáveis e editáveis;
- telas de Redes sociais e Workspace antigo superiores devem ser recuperadas quando a base nova estiver ausente/inferior;
- preservar partes boas dos players e mídia existentes;
- corrigir cantos, ícones, responsividade e densidade sem reconstruir páginas do zero.

## Processamento e arquitetura necessários

- Media Processor/worker para FFmpeg, proxy, waveform, thumbnails, render, tracking e Whisper;
- contratos idempotentes, progresso, retry, cancelamento e indisponibilidade honesta;
- uploads resumíveis e storage próprio; banco de metadados separado do conteúdo pesado;
- permissões e tenant no backend, auditoria, quotas, custos e observabilidade;
- IA/RAG/LLM router entram por contratos neutros e resultados revisáveis;
- mock pode servir como semente visual, nunca como sucesso final.

## Evidência e encerramento

Antes de marcar qualquer linha como concluída:

1. testar como usuário no navegador;
2. provar efeito observável e persistência quando aplicável;
3. verificar erros/console/reload;
4. executar testes automatizados proporcionais ao risco;
5. atualizar matriz, backlog, handoff e status;
6. registrar claramente o que ficou local, backend real, persistido ou pendente;
7. repetir comparação com AI Edita, PDFs, anexos e código para detectar omissões.

## Estado no momento desta consolidação

- Workspace 2 com Passos 1–5, Timeline 2 integrada, player final e exportações locais já possuem implementação parcial/funcional documentada na matriz.
- IN/OUT de sequência foi ligado ao editor, player final e render backend, com testes direcionados.
- Suíte frontend: 53 arquivos/181 testes aprovados; lint aprovado.
- Testes direcionados de mídia backend: 8 aprovados.
- Build frontend repetido e aprovado; permanecem avisos conhecidos de Browserslist, import dinâmico ineficaz e chunk grande.
- Atualização de 28/09/2026: agulha real, transição para Em aprovação e lacunas foram corrigidas e validadas localmente. As lacunas continuam em preto/silêncio nos players e agora também são materializadas no MP4 renderizado pelo backend, usando a posição temporal dos clipes.
- Nenhuma alteração deste bloco foi publicada em produção.

### Consolidação da página Edição — 28/09/2026

- o menu duplicado `Material para editar` foi removido;
- a página remanescente passou a se chamar `Edição`;
- os estados operacionais não foram apagados: `Para editar`, `Em edição` e `Aguardando aprovação` permanecem como filas internas da Central de edição;
- links, permissões salvas e atalhos antigos com `para_editar` são convertidos para `em_edicao`, evitando quebrar favoritos e configurações existentes;
- a compatibilidade foi validada no navegador local: a URL legada abriu diretamente a Central de edição unificada;
- suíte completa após a alteração: 54 arquivos/187 testes frontend aprovados, lint e build aprovados; avisos conhecidos de tamanho de chunk, Browserslist e importação dinâmica permanecem não bloqueantes.

### Timeline, keyframes, cantos e Legendas Pro — 28/09/2026

- a reprodução deixou de depender de uma fonte carregável exatamente no ponto da agulha: sequências com duração continuam avançando em lacunas ou durante reconexão de mídia e exibem quadro preto;
- o aviso `Posicione a agulha sobre um clipe reproduzível` foi removido do fluxo funcional;
- o losango do keyframe fica vazado em cinza quando não há ponto no quadro atual e azul preenchido quando há;
- o pacote anexado `AI-Edita-Legendas-Pro-v2.aiedita` foi validado como `ai-edita-style-pack` versão 1, com 32 templates; todos foram mapeados para propriedades editáveis da Timeline, agrupados por Palavra ativa, Uma palavra, Caixas, Neon & impacto e Editorial;
- foram acrescentados quatro estilos autorais MediaMind: Notícia, Documental, Social e Acessível;
- presets aplicam fonte, tamanho, peso, cor, contorno, sombra, fundo, raio e movimento ao clipe de texto; podem criar nova legenda no playhead ou ser aplicados à legenda selecionada;
- ainda pendem sincronização automática por palavra, tradução/karaokê temporal e aplicação equivalente no render backend; por isso `MM-CAPTION-001` continua `in_progress`;
- superfícies principais e cartões das telas entre Agendamentos e Finalizado, além de Para publicação, Publicado e Analytics, receberam `rounded-xl`/recorte de conteúdo sem alterar o fluxo estrutural;
- validação: 55 arquivos/191 testes frontend aprovados, lint e build aprovados. O preview local foi aberto diretamente na biblioteca de legendas. Nenhum deploy em produção foi realizado.

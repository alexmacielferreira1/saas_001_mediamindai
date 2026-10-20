# QA de usabilidade — MediaMind (2026-10-20)

Papel: testador, somente relata. Nada foi corrigido.
Ambiente: frontend Vite em http://localhost:5175 (sessão já autenticada como superadmin "Alex Maciel Ferreira", empresa "MediaMind Demonstração"), API em 127.0.0.1:8000 (de outro chat, não reiniciada). Navegador do painel, viewport emulado 1440x900.
Método: abertura de cada rota, leitura do texto/estrutura, cliques em amostras de elementos de cada tela, leitura de console e de rede, e varredura estática do código (botões `<button>` sem `onClick`, rotas, contrato de API). Alguns achados são confirmados na tela E no código; outros só no código (marcados "código").

Fora do escopo (conforme pedido): /ferramentas-graficas, /clipsfree, /clipsfree2, /timeline2, /workspace2 passo 4, /soundcraft, /ferramentas-office.

## 0. Achados transversais (valem para várias telas)

| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Console/rede, Home (`/`) | Abrir a Home | 6 requisições `GET /api/v1/records/{Project,Task,SavedSearch,RecentActivity,Library,IngestPackage}` retornam 404 `ENTITY_NOT_FOUND` (backend `records.py:58`) | Front consulta entidades que o backend não registra; a Home então mostra fixtures de `frontend/src/mediamind/data.js` (ex.: "Editar matéria Centro Histórico", "chuva em porto alegre", "ENTREVISTA_PREFEITO_RS.mov — há 2 min") sob o selo "Dados reais" | Alta | Ou registrar as entidades, ou parar de chamar e mostrar estado vazio; trocar o selo quando for fixture |
| Banner topo de TODAS as páginas | Abrir qualquer rota | "Rascunhos recuperados neste navegador / Baixar recuperação / Restaurar cópia anterior / Abrir recuperação" sempre visível | Ruído permanente, jargão técnico para usuário final, sem explicar o que é | Média | Mostrar só quando houver rascunho a recuperar, ou mover para menu "…" |
| Copiloto lateral (aberto por padrão) | Abrir qualquer tela em 1440 px | Ocupa ~40% da largura; conteúdo principal fica espremido (Workspace tem o título cortado "pace"; Administração tem cards de "Ações rápidas" com texto quebrado; tabela de Usuários exige rolagem horizontal) | Tela útil fica pequena; o usuário precisa descobrir "Recolher" | Média | Iniciar recolhido em telas < 1600 px ou lembrar a escolha |
| Copiloto, aba Executar | Ver painel | Duas caixas de texto empilhadas ("Descreva o que deseja fazer…" e "Converse, planeje…") | Não fica claro qual é entrada e qual é saída | Baixa | Tornar a primeira área de histórico (somente leitura) ou unir |
| Barra superior: sino | Clicar | Nada acontece. `Shell.jsx` ~linha 430: `<button>` sem `onClick`; ponto azul fixo parece notificação não lida | Botão morto e indicador falso | Média | Abrir painel de notificações ou remover o botão/ponto |
| Barra superior: engrenagem | Clicar | Nada acontece (`Shell.jsx` ~linha 434, sem `onClick`) | Botão morto | Média | Levar a /configuracoes/ia ou menu de preferências |
| Barra superior: tema | Procurar | Não existe seletor Claro/Escuro/Sistema no canto superior direito | Prioridade 1 do projeto ainda não visível (provavelmente em andamento) | Info | Skill `mediamind-tema` |
| Botões só com ícone (busca, sino, engrenagem, vários da Home e Corp) | Árvore de acessibilidade | `button` sem nome acessível (refs ~21, 23-25, 37-42, 46-49) | Leitor de tela e testes não identificam; sem tooltip | Baixa | `aria-label`/`title` |
| Paleta de comandos (clique na busca ou ⌘K) | Digitar "entrevista" | "Nada encontrado" | A barra diz "Pesquisar tudo — clientes, tarefas, funções, caminhos…", mas a paleta só acha ações e páginas, não mídias/roteiros/projetos. Ao digitar "acervo" acha a página. O campo também não recebeu foco ao abrir (primeira digitação ficou em fila) | Média | Ajustar o texto ("Ir para… / Criar…") ou indexar conteúdo; focar o input ao abrir |
| Menu "Novo" e paleta (`lib/quickActions.js`) | Ler sublinhas | Mostram nomes técnicos: "IngestPackage", "ProcessamentoJob", "Clip", "Ingest expresso" (`entity:`) | Jargão | Baixa | Trocar `entity` por rótulo amigável |
| Menu "Novo" (`quickActions.js:45-78`) | Executar ações | Só `novo=producao`, `novo=pacote`, `novo=publicacao` têm tratamento. As demais só navegam para a página genérica: "Nova biblioteca"→/acervo, "Novo processamento IA"/"Novo relatório"/"Nova empresa"→/management, "Novo roteiro"/"Nova tarefa"→/workspace, "Nova edição"/"Nova revisão"/"Novo release" etc. → /corp, "Nova publicação"/"Agendar publicação"→/social (mesmo destino) | Rótulo promete criação, a tela abre sem formulário. "Novo agendamento de gravação" e "Novo briefing" abrem o mesmo "Novo rascunho" de produção | Alta | Implementar `?novo=` nos destinos ou renomear para "Ir para…" |
| Menu lateral (`Shell.jsx:44-169`) | Comparar com `App.jsx` | Sem link para /acervo, /management (Gestão/Relatórios), /search, /social, /timeline, /roteiro2, /ferramentas-ia. "Ingest", "Pesquisa", "Workspace" do menu levam a `/corp?tab=producao&sub=…`, não às rotas /ingest, /search, /workspace (que são outras telas, com outro layout) | Existem duas versões de cada tela e só uma é alcançável pelo menu; Gestão e Acervo ficam escondidos | Alta | Decidir a versão canônica; incluir Acervo e Gestão no menu |
| Menu lateral | Ver ícones | "Canais Dark" e "Geração de vídeo" usam o mesmo ícone (Clapperboard) | Difícil distinguir | Baixa | Ícone diferente |
| Saudação | Comparar | Home (`Home.jsx:30-35`) diz "Bom dia" até 12h; Corp (`CorpGreeting.jsx:11`) diz "Boa noite" antes das 6h. Às 00:07 uma tela diz "Bom dia" e outra "Boa noite" | Inconsistência | Baixa | Reutilizar a mesma função |
| Redirecionamentos | Abrir | /workspace2→/workspace, /clips e /publish→/social, /reports→/management?tab=reports, /thumbnails→/estudio-de-arte, /video-estudio→/canais-dark: todos funcionam | Observação: /video-estudio cair em Canais Dark confunde (ver Agência de Vídeo) | Baixa | — |
| Hot reload | Console | `[vite] Failed to reload /src/App.jsx` e `ClipPlayer.jsx` (erros de sintaxe momentâneos) e rajadas de 500 | Ruído do trabalho de outros agentes durante a sessão; não atribuído a defeito do produto | Info | Reexecutar a navegação quando o repositório estiver estável |

## 1. Home (`/`)

| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Selo "Dados reais" | Ler | Aparece ao lado de listas que vêm de `data.js` (ver seção 0) | Rótulo enganoso | Alta | Ver seção 0 |
| KPIs (Produções 7, Finalizadas 2…) | Ler | Vêm de `/dashboard/me` (200); Tarefas "Todas 5 / Em andamento 2" vêm das fixtures | Números de fontes diferentes na mesma tela | Média | Uma fonte só |
| "Perfis" (`Home.jsx:97`) | Clicar | Vai para /corp (sem perfil específico) | Rótulo "Perfis" vago; destino genérico | Baixa | Renomear "Abrir Produção" |
| "Continuar de onde parou", "Projetos recentes", "Ver todos" (`Home.jsx:124,235,240`) | Clicar | Todos vão para /workspace, sem abrir o item clicado | Clique em item específico perde o contexto | Média | Levar ao item (`?id=`) |
| "Ver agenda" (`Home.jsx:213`) | Clicar | Vai para /corp | Não abre a agenda | Baixa | `/corp?tab=producao&sub=agendamentos` |
| Agenda | Ler | 6 compromissos repetidos ("A trajetória do Preto…" 3x, "Entrevista mensal" 3x) em horários idênticos | Duplicados visíveis | Baixa | Deduplicar/agrupar |

## 2. /corp (Produção) — abas do menu

Cada aba carregou sem erro de console além do já citado (a exceção está na aba Pesquisa).

| Aba | Elemento | Ação / resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Visão geral | KPIs, "Continuar de onde parou", calendário | Dados reais do tenant (7 produções). Calendário abre em JULHO DE 2026 embora hoje seja 20/10/2026 | Abre no mês do primeiro evento, não no mês atual; sem botão "Hoje" visível | Média | Abrir no mês atual |
| Visão geral | 6 botões só com ícone em "Continuar" e 4 no resumo | Sem rótulo | Não se sabe o que fazem | Baixa | `aria-label` |
| Rascunhos | "Novo rascunho", formulário, "Salvar briefing", "Marcar gravação" | Formulário completo e orientação ("data é opcional no rascunho, mas obrigatória ao agendar") | Bom. Botões "Alterar thumbnail" e "+ Adicionar tag" sem `onClick` no código (`RascunhosPage.jsx:197-198`) | Média | Ligar ou ocultar |
| Agendamentos | KPIs, calendário, painel de detalhe, "Redefinir" | "Redefinir" restaura só o layout dos painéis (executa sem confirmação, mas não perde dados) | Rótulo ambíguo ("Redefinir" o quê?) ao lado de "Exportar/Importar" que sugerem dados | Média | "Restaurar layout" |
| Agendamentos | Campo Data | Mostra "18/09/2…" truncado enquanto o calendário exibe o compromisso em 18 de julho | Possível divergência de data entre detalhe e calendário (a conferir) e campo estreito | Média | Verificar `AgendaEvento`; alargar campo |
| Agendamentos | "Confirmar com videomaker" / "Confirmar e enviar para Gravações" | Dois botões com efeito próximo | Fluxo pouco claro | Baixa | Um botão primário |
| Gravações | Estado vazio | "Nenhuma gravação em andamento. Agende e designe um videomaker em Agendamentos." com link | Bom estado vazio | — | — |
| Edição | Fila + editor | Abre o editor MMFilm completo (centenas de controles) mesmo com "Selecione um projeto"; texto "Mostrar fila e detalhes" | Editor aparece antes de escolher projeto; o fluxo "perde" quem só quer ver a fila | Média | Mostrar a fila primeiro e abrir o editor ao escolher |
| Alteração | Tela | Reutiliza "Central de edição" (mesmo título que Edição) e mostra "Nenhuma entrega nesta etapa." | Duas abas do menu com a mesma tela e título; "Alteração" no menu vs "EM ALTERAÇÃO" nos KPIs | Baixa | Título próprio |
| Em revisão | Painel de revisão | Comentários, histórico e versões (V1-V3) são os de demonstração (`DEMO_COMMENTS`; "Jornal_da_Cidade_V3.mp4", "Roteiro_JC_Ep235.pdf" para o episódio "Desafios do SUS") | Dados fictícios misturados ao projeto real; "Nenhum vídeo vinculado à revisão" | Alta | Carregar comentários reais ou rotular demonstração |
| Em revisão | "Aprovar versão", "Rejeitar e enviar para Alteração", "Enviar para Alteração" | Não clicados (ação irreversível). Botões "Editar", "+ Nova versão", "Comparar versões", "Ir para timecode", "Ver completo" sem `onClick` (`AprovacaoReviewPanel.jsx:233,234,242,252`) | Botões mortos | Média | Ligar ou remover |
| Finalizado | Detalhe | "CHECKLIST FINAL 0/0"; histórico com datas 08–16/10 e "Aprovado em 18/09/2026" | Datas contraditórias; checklist vazio sem orientação. "Baixar master" e "Copiar link" sem `onClick` (`FinalizadoTimeline.jsx:87`) | Média | Ligar ou ocultar; alinhar datas |
| Redes sociais | Central | "POTENCIAL MÉDIO 0/100"; aviso "Recorte de demonstração — a versão fica só local"; "Novo corte" duplicado (cabeçalho e lista); "Ir para aprovação" vs "Prosseguir pra Publicações" | Mistura demo/real; botões com destinos diferentes para o mesmo avanço; botões "Solicitar ajustes/Rejeitar/+ Novo comentário/+ Gerar com IA" sem `onClick` (`ClipSocialStages.jsx:19,21,34`) | Média | Padronizar rótulos |
| Para publicação / Publicado | Lista e painel | Selecionar item mostra métricas fixas (12.4K views, 842 curtidas…), "Conta: @canaloficial", histórico "18:30 Publicação confirmada" mesmo para RASCUNHO/PROGRAMADO; canais "Publicado/Programado" iguais para todos | Valores fixos no código (`CorpPublications.jsx` ~linhas 51-52) apresentados como reais | Alta | Mostrar "—" até haver dado |
| Para publicação | "Excluir" (`CorpPublications.jsx:53`), "Abrir canal", "Copiar URL", "…" (`:49`), filtros "Canal/Programa/Período/Status" (`:44`), alternância cards/lista | Sem `onClick` | 8+ botões mortos; "Excluir" também sem confirmação (quando for ligado, exigir) | Alta | Ligar ou ocultar |
| Para publicação | "Editar no canal" | Mostra aviso verde "Edição do canal aberta para esta mídia." sem abrir nada | Aviso falso (mensagem diz que abriu) | Alta | Remover aviso ou implementar |
| Para publicação | "Nova publicação", "Duplicar", "Programar mesma mídia" | Criam rascunho só em memória (`localDrafts`), somem ao recarregar | Perda silenciosa; título/descrição são `defaultValue` sem salvar | Alta | Persistir ou avisar |
| Publicado | Mesma tela | Painel de um item PUBLICADO mostra "YouTube Shorts: Programado" | Contradição | Média | Idem |
| Analytics | Todo o painel | Números fixos (1.284.520 visualizações, R$ 18.420 investimento, Top conteúdos, campanhas) sem selo de demonstração; /management diz 1 publicação e "Métricas aparecerão após a conexão das redes" | Dados fictícios como reais, contradição direta com Gestão | Alta | Selo "Demonstração" ou estado vazio |
| Analytics | "Gerar análise", "Gerar relatório", "Compartilhar dashboard", "Ver todos/todas", filtros de período/programa/canal, "Exportar recorte/ranking", "Salvar relatório" | Sem `onClick` (`CorpAnalytics.jsx:35,44,45,46,75,77,79`) | ~12 botões mortos | Alta | Ligar ou ocultar |
| Ingest / Pesquisa / Workspace (sub) | Pesquisa | Lista mídia com status cru em inglês ("reviewed", "indexed", "processing") e subtítulo "ASSET-00d348eb8c-…" em vez do nome do arquivo; documento PDF com ícone de vídeo | Rótulos técnicos; /search traduz ("Revisado") — inconsistente | Média | Reusar `STATUS` de Search.jsx |
| Pesquisa | Prévia | `GET /api/v1/media/assets/{id}/stream` → **500 INTERNAL_ERROR** ao abrir a página (primeiro ativo selecionado); player mostra controles sem mídia | Erro de servidor no caminho comum; deveria ser 404/mensagem "arquivo indisponível" (`backend/app/api/v1/media.py`, arquivo em edição por outro chat) | Alta | Tratar arquivo ausente |
| Todas | Seletor de perfil "Produção" (dropdown abaixo do título) | Não explorado a fundo | Título "IAcervo Corp" sem relação com o menu "Produção" | Baixa | — |

## 3. /ingest

| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Cabeçalho | Ler | "Nova Ingestão" aparece como título e como botão; contadores "Falhas 1 / Concluídas 1 / Em andamento 1" enquanto Acervo informa "Falhas 0" e `IngestPackage` retorna 404 | Dados incoerentes | Média | Fonte única |
| Armazenamento | Ler | "0 B enviados / Capacidade não configurada" vs Acervo "6.2 GB" | Duas verdades | Baixa | Unificar |
| Assistente de 3 etapas | Ler | Etapas claras; "Criar pacote e continuar →" orienta o passo seguinte | Bom. "Programa / Projeto" lista só projetos fixture | Baixa | — |
| Botões (`IngestList.jsx:69` "Reprocessar", `IngestNewPackage.jsx:95` "Novo pacote", `CorpIngestPanel.jsx:65` "Iniciar Ingest") | Código | Sem `onClick` detectado (candidatos) | Possível botão morto; verificar na tela | Média | Verificar |

## 4. /search

| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| "Buscar" (`Search.jsx:31`) | Clicar | Nada (a busca já filtra ao digitar) | Botão sem função | Baixa | Remover ou submeter |
| "Filtros avançados", "Período/Programa/Pessoa/Categoria/Formato/Status ▾", "Mais relevantes ▾" | Clicar | Sem `onClick` | 8 controles de filtro mortos | Alta | Ligar ou ocultar |
| "Editar informações", Play/MonitorPlay/Maximize, "Download", "Mais ações" | Clicar | Sem `onClick`; player é simulado (barra a 42% fixa) | Botões e player decorativos | Alta | Ligar ou ocultar |
| "Adicionar ao roteiro" e "Usar na produção" | Ler destinos | Ambos vão para `/corp?tab=producao&assetId=…` | Dois rótulos, mesmo destino; o Corp não consome `assetId` (a conferir) | Média | Destinos distintos |
| Detalhe | Ler | "Duração 00:00:28" fixa para qualquer mídia; Transcrição com 3 linhas fixas; "Direitos: Uso interno" fixo; programa padrão "Jornal da Cidade" quando vazio; placeholder de busca "mobilidade urbana" | Dados fabricados exibidos como da mídia | Alta | Mostrar real ou "—" |
| Ação "Abrir no Workspace" | Árvore | Aparece como `generic` (não botão/link focável por teclado) | Acessibilidade | Baixa | Usar `<Link>` direto |

## 5. /acervo

| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Abas Arquivos / Usuários / Sistema | Ler | Tela de Arquivos com 8 itens, "Saúde do acervo: Integridade Saudável" | Primeira linha (vídeo) com ícone de microfone; ordem de datas misturada (2026-06 antes de 2026-09) | Baixa | Ordenar por data |
| Acesso | Menu | Rota sem link no menu (só pela paleta, Administração→Acervo ou "Gerar corte") | Descobribilidade | Média | Link no menu |
| Admin → aba Acervo | Abrir | Mostra "Carregando acervo..." (não esperei concluir; mesma tela em /acervo carrega) | Não verificado em detalhe | Baixa | Reavaliar |

## 6. /workspace (passos 1-3) e /workspace2

| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| /workspace2 | Abrir | Redireciona para /workspace | OK | — | — |
| "Resetar projeto" | Clicar (projeto vazio, não salvo) | Executa na hora, exibe "Projeto restaurado ao padrão" | Sem confirmação em ação que descarta trabalho | Alta | Confirmar quando houver dados |
| "Salvar e não continuar" (`Workspace2Create.jsx:47`) | Ler | Rótulo confuso (parece "salvar e sair"?) | Rótulo | Média | "Salvar e continuar depois" |
| Passo 1 | Ler | Indica "O material escolhido na Pesquisa estará disponível na próxima tela." e "Mídias selecionadas (0)" | Guia razoável. Layout espremido pelo Copiloto (título cortado) | Média | Ver seção 0 |
| Botões "Importar mídias / Importar projeto / Exportar", "Como criar?" | Não explorados em profundidade | Visíveis | — | — | — |
| Código (`Workspace2Search.jsx:64,114`, `Workspace2Timeline.jsx:86`, `Workspace2Script.jsx:46`) | Código | "Assistir", "Pesquisa", "Mídias do projeto", "Biblioteca IA" sem `onClick` detectado | Candidatos a botão morto (passo 3 está fora do escopo parcialmente) | Média | Verificar |

## 7. /timeline

| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Título "Modo roteiro" | Ler | A rota se chama Timeline e o título é "Modo roteiro"; existe também /timeline2 e /roteiro2 | Três telas parecidas, nomes que não distinguem | Média | Nomear por finalidade |
| Roteiros (4) | Ler | Dados de fixture (Jornal 15h — 15/05 etc.); "Enviar para edição", "Exportar", "Salvar" | Rotas sem link no menu | Baixa | — |
| Botões (`WorkspaceTimelineBar.jsx:115`, `RoteiroTimeline.jsx:112` "Cortar") | Código | Sem `onClick` detectado | Candidatos | Média | Verificar |

## 8. /administration2 (todas as abas)

Abas: Visão Geral, Usuários, Acessos por Função, Perfis e Funções, Permissões, Equipes, Formulários, Importações, Segurança, Acervo, Gestão, Telas e Módulos, Cadastros, Integrações, Configurações (15 abas em barra com rolagem horizontal, sem setas; as últimas ficam escondidas).

| Aba | Elemento | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Todas | Selo "Dados reais do tenant selecionado" + "Área validada" | Presente também nas abas que dizem "Dados de demonstração visual — … alterações permanecem desabilitadas" (Equipes, Formulários, Importações, Segurança, Cadastros, Integrações, Telas e Módulos) | Selo contradiz o aviso da aba | Alta | Selo por aba |
| Visão Geral | "Ações rápidas" | Cards "Novo usuário / Convidar / Novo perfil / Nova importação / Novo formulário" com texto quebrado/truncado com o Copiloto aberto | Visual | Baixa | Grade responsiva |
| Usuários | Tabela | 33 usuários; coluna "Equipe / Setor" = "Não integrado" em todas as linhas; "Função" mostra códigos crus (`journalist`, `produtor_reportagem`); Perfil "Operadores de conteúdo" para quase todos; tabela ocupa ~2/3 e rola horizontalmente com espaço vazio à direita; sem paginação; sem botão "Novo usuário/Convidar" na própria aba | Coluna placeholder, jargão, layout | Média | Ocultar coluna; traduzir funções |
| Usuários | Abas "Referência / Anterior +1" | Alternam versão nova e legada da lista | Rótulo incompreensível | Média | "Atual / Legado" ou remover |
| Usuários | "Ver detalhe" | Abre painel lateral abaixo dos KPIs (precisa rolar para vê-lo) com "Encerrar sessões" e "Suspender usuário" | Painel fora da vista; ações de risco confirmadas por `window.confirm` (`Administration2.jsx:267,273,279`) — OK, não executei | Média | Abrir como gaveta fixa |
| Equipes | Lista | "Mariana Silva", "Carlos Mendes" etc. (fixture) com aviso de demonstração | Dados fictícios (avisados) | Baixa | — |
| Formulários | Lista | 126 respostas, 243 respostas… fixtures | Idem | Baixa | — |
| Importações | Tela | Planilha "usuarios_setembro.xlsx" de exemplo, "11 erros pendentes" | Idem | Baixa | — |
| Segurança | KPIs | "MFA 78% — 24 de 31 usuários" vs 33 usuários ativos na Visão Geral | Números incoerentes | Média | Rotular demo |
| Código | `UsersForms2.jsx:45` "Suspender" (usuário fixture) sem `onClick` e telefone/cargo fixos; `AccessStructure2.jsx:52,63,72,93`, `Security2.jsx:179,183` ("Reenviar", "Cancelar", "Renovar acesso"), `Imports2.jsx:66,95` | Código | Botões sem `onClick` | Média | Verificar se o arquivo é usado |
| Integrações | Tela | Honesta: "Estado não verificado", "Telemetria ainda não conectada" | Bom exemplo | — | — |
| Configurações | "Salvar configurações" | Não clicado (grava configuração) | — | — | — |
| Acervo / Gestão (dentro da Administração) | Abrir | Ficaram em "Carregando…" na leitura imediata | Não confirmei fim do carregamento | Baixa | Reavaliar |

## 9. /management (e /reports)

| Elemento | Ação | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|---|
| Visão Geral | KPIs | Números reais, estados vazios honestos ("—", "0 amostras", "Métricas aparecerão após a conexão autorizada") | Bom. Incoerência: "Publicações agendadas 0" com calendário mostrando item "programado"; "Taxa de aprovação 33%" vs "Taxa conclusão 29%" | Baixa | Revisar cálculo |
| /reports → ?tab=reports | Abrir | Abas Equipe / Setor(es) / Redes Sociais / Conteúdo / Acervo / Sugestões; "Desempenho da equipe" com todos "0 atribuídos, 0 em andamento, 0 concluídos" para 30+ pessoas | Tabela cheia de zeros sem explicação (tarefas não ligadas) | Média | Mensagem "sem tarefas atribuídas" |
| `?tab=processing` | Abrir | Mostra Visão Geral (parâmetro não reconhecido, sem aviso) | Aba errada silenciosa (a chave real da URL não foi descoberta) | Baixa | Validar parâmetro |
| Acesso | Menu | Sem link no menu lateral | Descobribilidade | Média | Incluir |

## 10. /social (e /clips, /publish)

| Elemento | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|
| Mesma "Central de conteúdo social" da aba Redes sociais do Corp (6 etapas) | Redirecionamentos /clips e /publish chegam aqui | /publish (Publicação) cai em "Cortes para Redes Sociais": rótulo não corresponde | Média | Redirecionar /publish para Para publicação |
| "Novo corte" 2x, "Ir para aprovação", aviso "Edições… são uma prévia", "Potencial 0/100" | Mesmos achados da aba Redes sociais | Média | — |
| `SocialRightPanel.jsx:67,80`, `SocialClipsTable.jsx:139,142` ("Editar", "Enviar p/ publicar", "Abrir fila de publicação") | Sem `onClick` detectado | Candidatos | Média | Verificar |

## 11. /canais-dark (e /video-estudio)

| Elemento | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|
| Estado vazio | "Nenhum canal cadastrado ainda." + "Novo canal" + "Criar canal" + 9 abas (Canais, Pastas, Materiais, Gerar vídeos, Thumbs, Cortes, Revisão final, Agendados, Analytics) | Boa orientação; "Novo canal" e "Criar canal" duplicados; 9 abas visíveis antes de existir canal | Baixa | Ocultar abas até criar |
| "Configurar provedores de IA" | Vai para configuração de IA | OK pelo rótulo | — | — |
| /video-estudio | Redireciona para /canais-dark | Mas a Agência de Vídeo tem link "Abrir VIDEO_ESTUDIO" (`AgenciaVideo.jsx:70`) que leva a Canais Dark | Rótulo interno em maiúsculas e destino inesperado | Alta (pequena correção) | Renomear ou apontar para /geracao-de-video |

## 12. /thumbnails e /estudio-de-arte

| Elemento | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|
| /thumbnails | Redireciona para /estudio-de-arte | OK | — | — |
| Estúdio de Arte | A tela abre direto em "01 Thumb 1 — Corações e Mentes" sem título de página; dezenas de controles | Falta orientação do primeiro passo; programa e entrevistados vêm de lista fixa (Dr. Carlos Mendes…) | Média | Título + passo inicial |
| /ferramentas-ia ("Thumbnails IA / Abrir editor de Thumbnails") | Mais uma entrada para thumbnails (3 lugares: Ferramentas IA, Estúdio de Arte, Thumbs nos Canais Dark) | Sobreposição | Média | Unificar entrada |

## 13. /ferramentas-ia, /geracao-de-video, /agencia-video

| Rota | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|
| /ferramentas-ia | 17 abas (Imagem IA … Dublagem) e a primeira é "Thumbnails IA" | Rota sem link no menu; abas demais sem agrupamento | Média | Agrupar |
| /geracao-de-video | Estados honestos: "Nenhuma conexão ativa… Configurar IA", etapas "Pendente" | Bom; "Pipeline de 8 etapas" e "Video Studio" com dois títulos | Baixa | Um título |
| /agencia-video | "Protótipo supervisionado", "Modo protótipo — nenhuma IA conectada", "Limpar testes" | Honesto; "Limpar testes" é destrutivo local — não clicado (não verifiquei a confirmação) | Média | Confirmar |

## 14. /assistente, /dash-ias, /configuracoes/ia, /roteiro2

| Rota | Resultado | Problema | Sev. | Sugestão |
|---|---|---|---|---|
| /assistente | Chat com "Gravar áudio / Enviar arquivo / Enviar"; mesmo propósito do Copiloto lateral | Dois assistentes de IA diferentes (Copiloto e Assistente IA) | Média | Esclarecer papel de cada |
| /dash-ias | Telemetria vazia com avisos corretos; filtros "Último dia / 7 dias / 30 dias / 31 dias" | "30 dias" e "31 dias" quase iguais | Baixa | Remover um |
| /configuracoes/ia | "Nenhuma IA cadastrada. Clique em Adicionar IA."; sem o menu lateral/banner comuns às demais telas | Boa orientação; página fora do shell? (sem recuperação/rascunho) | Baixa | — |
| /roteiro2 | Metadados "Roteiro 2 / Prévia paralela", modelos clicáveis, 8 mídias com seleção | Nome "Roteiro 2" não informa diferença para Workspace; sem link no menu; "Relatório Turismo Centro" com duração 00:00 | Média | Nomear/ligar |

## 15. Barra superior e menu lateral (resumo de cliques)

| Elemento | Resultado |
|---|---|
| Recolher lateral | Funciona |
| Busca (clique) | Abre paleta; ver seção 0 |
| "Novo" | Abre menu agrupado por área; itens navegam (ver seção 0) |
| Seletor de empresa | Abre menu com "Todas as empresas", "MediaMind Demonstração" (marcada) e "Trocar de empresa…" (item redundante dentro do próprio seletor) |
| Sino / engrenagem | Mortos |
| Links do menu | Todos os 18 links do menu abriram a página correspondente |
| "Sair" | Existe (botão no fim do menu); não clicado |

## Melhorias óbvias (pequenas e sem risco)

1. `frontend/src/mediamind/Shell.jsx` ~430 e ~434: sino e engrenagem sem `onClick`; ao menos remover o ponto azul fixo ou ligar a /configuracoes/ia.
2. `frontend/src/mediamind/pages/AgenciaVideo.jsx:70`: link "Abrir VIDEO_ESTUDIO" aponta para `/video-estudio`, que redireciona para `/canais-dark` (`App.jsx:112`). Renomear o rótulo e/ou apontar para `/geracao-de-video`.
3. `frontend/src/App.jsx:97`: `/publish` redireciona para `/social` (cortes). Redirecionar para `/corp?tab=producao&sub=para_publicar`.
4. `frontend/src/mediamind/components/corp/CorpPublications.jsx:53`: "Excluir" sem ação nem confirmação; `:49` "Abrir canal", "Copiar URL", "…" mortos; `~:51-52` métricas e histórico fixos; `Action "Editar no canal"` mostra aviso falso. Remover ou rotular.
5. `frontend/src/mediamind/components/corp/CorpAnalytics.jsx:35,44-46,75-79`: botões sem ação e números fixos; adicionar selo "Demonstração" no cabeçalho.
6. `frontend/src/mediamind/pages/Search.jsx:31,38,39,49`: "Buscar", filtros, "Editar informações", "Download", "Mais ações" sem ação; "Duração 00:00:28", transcrição e "Direitos" fixos (`:36-38`); "Adicionar ao roteiro" e "Usar na produção" com a mesma URL (`:39`).
7. `frontend/src/mediamind/components/workspace2/Workspace2Create.jsx:47`: "Salvar e não continuar" → "Salvar e continuar depois". Botão "Resetar projeto" (Workspace2 header): pedir confirmação.
8. `frontend/src/mediamind/pages/Home.jsx:30-35` e `components/corp/CorpGreeting.jsx:11`: usar a mesma função de saudação.
9. `frontend/src/mediamind/lib/quickActions.js:45-78`: trocar `entity` técnico (IngestPackage, ProcessamentoJob, Clip) por rótulo em português; renomear ações que só navegam (ex.: "Ir para Gestão" em vez de "Novo relatório").
10. `frontend/src/mediamind/pages/Administration2.jsx` (selo "Dados reais…" no cabeçalho): ocultar nas abas marcadas como demonstração; rótulo "Anterior +1" (`:282`) → "Versão anterior".
11. Admin Usuários (`components/admin2/PeopleAccessSections.jsx`): ocultar coluna "Equipe / Setor" enquanto for "Não integrado"; traduzir `tenant_role` para o nome amigável.
12. Pesquisa do Corp (`WorkspaceResearch.jsx`): usar o mapa `STATUS` de Search.jsx e mostrar o nome do arquivo em vez de "ASSET-…".
13. Backend `GET /api/v1/media/assets/{id}/stream` retorna 500 para ativos do seed (arquivo ausente); devolver 404/410 com mensagem — arquivo `backend/app/api/v1/media.py` está em edição por outro chat, só registrar.
14. Botões sem `onClick` (candidatos da varredura estática, a confirmar na tela; ver lista): `components/corp/CorpProductionDetail.jsx:226-227` (Recusar/Aprovar), `corp/roles/AudiovisualPage.jsx:75-76`, `DesignPage.jsx:93-94`, `QualidadePage.jsx:55-56`, `CedocPage.jsx:343-345,546-549`, `AssessoriaPage.jsx:47`, `EndomarketingPage.jsx:36`, `RedacaoPage.jsx:39`, `RevistasPage.jsx:37`, `GravacaoPage.jsx:27`, `EstagiarioPage.jsx:90`, `CorpMediaPanel.jsx:16,19`, `CorpProductionsList.jsx:25,28`, `RoteiroEditor.jsx:64,67,70` (Salvar/Exportar/Enviar para edição), `WorkspaceRoteiroPanel.jsx:149,152,155`, `WorkspaceSearchPanel.jsx:74`.
15. Acessibilidade: nome acessível (`aria-label`) nos botões só com ícone (busca, sino, engrenagem, Home, Corp).

## Sugestões para Alex decidir (mudanças de fluxo / maiores)

1. Política de dados fictícios: hoje fixtures aparecem sem rótulo em Analytics, Para publicação/Publicado, Em revisão, Home, Administração (Equipes, Formulários, Importações, Segurança). Decidir: selo "Demonstração" por bloco, ou estado vazio quando não houver dado real. É o ponto que mais afeta a confiança de quem usa.
2. Duas versões de cada tela (rotas independentes /ingest /search /workspace /social x abas de /corp): escolher a canônica, redirecionar a outra e colocar Acervo e Gestão no menu lateral.
3. Copiloto aberto por padrão consome ~40% da largura: iniciar recolhido (ou 25%) e lembrar a escolha por usuário.
4. Menu "Novo" e paleta: ou implementar formulários de criação em cada destino (`?novo=`), ou separar em "Criar" e "Ir para".
5. Edição: mostrar primeiro a fila e abrir o editor MMFilm só ao escolher um projeto; "Alteração" merece tela própria.
6. Para publicação: decidir se o painel de detalhes é só visual ou se terá persistência (rascunhos locais somem ao recarregar).
7. Pesquisa universal: a barra promete "tudo"; decidir se a paleta passa a buscar mídias/roteiros/projetos (a API de busca já existe em /search).
8. Dois assistentes de IA (Copiloto lateral e /assistente) e três pontos de entrada para thumbnails: consolidar.
9. Barra de abas da Administração com 15 itens: agrupar (Pessoas, Estrutura, Dados, Sistema) ou usar menu lateral secundário.
10. Tema Claro/Escuro/Sistema: seletor ainda não aparece no canto superior direito.

## O que foi testado, o que passou, o que falhou

Testado e executado: abertura de todas as rotas do escopo e das 15 abas do menu Corp (todas carregam, sem tela em branco); 15 abas da Administração; /management (Visão geral e Relatórios); menu "Novo"; paleta de comandos (busca por "acervo" e "entrevista"); seletor de empresa; recolher Copiloto; "Redefinir" da Agenda; "Resetar projeto" do Workspace (sem confirmação); "Ver detalhe" de usuário (painel abriu; confirmações de suspender/encerrar sessões verificadas no código); contrato de rede observado: 200 em `auth/session`, `tenants`, `mcp/tools`, `dashboard/me`, `management/overview`, `records/ProducaoProjeto`, `records/AgendaEvento`, `media/assets`; falhas: 6x 404 de `records/<Entidade>` na Home e 500 em `media/assets/{id}/stream` na Pesquisa do Corp.

NÃO coberto:
- Rotas fora do escopo (listadas no início).
- Ações que alteram dados ou publicam: Aprovar/Rejeitar versão, Excluir publicação, Suspender usuário, Salvar configurações, Criar pacote/ingest/upload, Gerar com IA, enviar ao Copiloto/Assistente, "Limpar testes" da Agência, "Sair". Verifiquei só por código quando havia confirmação.
- Clique individual em cada um dos centenas de controles dos editores (MMFilm da aba Edição, Estúdio de Arte, Roteiro/Workspace passos 2-3, Roteiro2, Canais Dark após criar canal, Ferramentas IA - 17 abas): coberta só a abertura e a leitura.
- Abas "Acessos por Função", "Perfis e Funções" e "Permissões" da Administração e as abas Processamentos/Auditoria de Gestão: não abertas por tela; /administration2 Acervo/Gestão ficaram em "Carregando…" na leitura imediata.
- Varredura estática de botões sem `onClick`: é heurística (regex), excluiu pastas de outros agentes; os itens do item 14 são candidatos, não confirmados na tela. Pode haver falso positivo (handlers por delegação/spread) e falso negativo.
- Não rodei lint/typecheck/build nem Vitest (escopo era usabilidade; repositório está em edição por vários agentes).
- Apenas viewport 1440x900 em tema escuro; sem teste de mobile/tablet, tema claro, teclado, nem leitor de tela (apenas árvore de acessibilidade).
- Usuário testado: superadmin; telas por papel (produtor, editor, etc.) e RBAC do menu "Novo" não foram exercitados com outras contas.

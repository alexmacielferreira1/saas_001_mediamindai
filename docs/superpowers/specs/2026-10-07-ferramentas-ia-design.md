# Ferramentas IA — desenho funcional e arquitetura incremental

## Objetivo

Adicionar ao MediaMind principal uma central **Ferramentas IA** integrada ao
produto, com onze guias:

1. Thumbnails IA;
2. Carrossel IA;
3. Bordas/Molduras;
4. Cortes Automáticos;
5. Vídeo Studio;
6. Montagem por Falas;
7. Vídeos de Vendas;
8. Vídeos Afiliados;
9. Radar de Tendências;
10. Vídeos Animados;
11. Dublagem IA.

A central não será uma coleção de demonstrações isoladas. Cada guia deve abrir
um fluxo real que reutiliza projeto, acervo, player, roteiro, Timeline 2,
aprovação e exportação já existentes. Uma capacidade só será marcada como
disponível quando seu fluxo persistir dados, respeitar autorização e produzir a
saída declarada.

## Fontes e limites

- Especificação funcional de referência:
  `Relatorio_WiSkills_para_MediaMindAI.md`, inspecionado em 07/10/2026.
- Código e estado reais: este repositório `001_mediamindai`.
- WiSkills é referência de comportamento, não fonte de código. Nenhum código,
  prompt interno, modelo ou contrato proprietário será copiado sem licença.
- Acesso ao fornecedor só será solicitado se uma dúvida funcional não puder ser
  resolvida pelas evidências já coletadas. Nesse caso, o login será interativo;
  credenciais não serão recebidas no chat nem persistidas no projeto.
- Render, Neon, GitHub e produção permanecem intocados sem autorização
  explícita.

## Estado real que o desenho deve preservar

O repositório atual já contém:

- autenticação, tenant e controle de módulos;
- projetos/produções, acervo e uploads locais funcionais;
- Workspace 2, roteiro, pesquisa de mídia, player e Timeline 2;
- exportação MP4 local da timeline e preservação de lacunas;
- fluxo editorial, aprovação e publicação em evolução;
- uma implementação local ainda não commitada de `Criar Thumbs`, com rota,
  compositor e exportação PNG.

Permanecem pendentes como fundações transversais: jobs duráveis, worker,
documentos criativos versionados no backend, ACL uniforme para derivados,
auditoria integral de IA/exportação e persistência PostgreSQL ponta a ponta de
alguns fluxos. O marco M0 continua formalmente com gates pendentes; esta entrega
não o promoverá por decreto.

## Abordagem escolhida

Implementar **fatias verticais**, começando pela base mínima e por um guia que
possa ser concluído sem depender do motor audiovisual completo.

Abordagens rejeitadas:

- criar as onze telas primeiro: produziria controles sem comportamento real;
- construir onze subsistemas separados: duplicaria documentos, permissões,
  jobs, renderização e exportação;
- esperar toda a plataforma de jobs ficar pronta: bloquearia ferramentas de
  documento estático, como Carrossel, que podem entregar valor antes.

## Navegação e experiência

### Entrada principal

A rota canônica será `/ferramentas-ia`. Ela entrará na navegação e no catálogo
de módulos existente, sem criar um segundo sistema de autenticação ou
permissões.

O cabeçalho da página conterá:

- projeto/produção atual, quando recebido por navegação contextual;
- ação para escolher ou trocar projeto;
- origem dos dados herdados;
- retorno ao projeto ou fluxo de origem;
- estado de salvamento e revisão do documento atual.

### Guias

As onze guias terão registro central com identificador estável, rótulo, rota
interna, permissão necessária e estado de disponibilidade. A guia disponível
monta sua ferramenta real. Uma guia ainda não entregue será identificada como
indisponível e não exibirá formulário, botão de executar ou mensagem de sucesso
simulados.

Atalhos contextuais como “Criar thumb”, “Criar carrossel”, “Sugerir cortes” e
“Montar chamada” abrirão a mesma ferramenta com `project_id`, origem e contexto
já preenchidos. O uso independente continuará possível e permitirá vinculação
posterior, sem conceder acesso implícito a projeto privado.

### Integração de Thumbnails

A implementação local de `/thumbnails` será preservada. A central apontará para
ela ou a hospedará pela mesma rota interna, sem duplicar compositor ou lógica de
exportação. Sua persistência e integração posterior serão evoluídas em tarefa
própria; este projeto não sobrescreverá o trabalho não commitado existente.

## Domínio compartilhado

### Documento criativo

As ferramentas produzirão documentos editáveis, não apenas arquivos finais. Um
documento possui:

- `id`, `tenant_id`, `project_id` opcional e `tool_type`;
- `schema_version`, revisão e estado editorial;
- conteúdo JSON validado conforme o tipo da ferramenta;
- referências a assets, roteiro, transcrição, timeline e template;
- origem dos dados herdados e overrides locais;
- criador, atualizador e timestamps;
- versão aprovada e histórico mínimo de revisões.

O conteúdo tipado será validado por schema específico. Um JSON arbitrário não
será aplicado diretamente ao editor.

### Revisões e exports

Salvar uma edição cria ou atualiza o rascunho corrente. Aprovação congela uma
revisão identificável. Cada export referencia uma revisão imutável e registra:

- preset, formato e dimensões;
- fontes e template usados;
- status, caminho relativo e checksum;
- responsável, início e conclusão;
- erro público quando falhar.

Editar depois de exportar não altera o arquivo anterior. Nova saída exige novo
export.

### Jobs

Operações instantâneas e determinísticas podem responder na própria requisição.
Transcrição, render de vídeo, remoção de fundo, TTS, dublagem e lotes usam o
contrato durável de jobs previsto no backlog:

`queued → preparing → processing/rendering → packaging → validating → ready`

Falhas entram em `failed` com retry seguro; cancelamento deve ser explícito.
Jobs capturam um snapshot da revisão, são idempotentes e reaparecem após reload.
A primeira fatia implementará apenas o mínimo exigido pelo Carrossel; não criará
um worker audiovisual fictício.

### Autorização e auditoria

- A permissão de tela controla entrada na central, mas não substitui a
  autorização de backend.
- Ler projeto, asset, transcrição ou roteiro exige acesso ao recurso de origem.
- Editar, aprovar, exportar e baixar são ações separadas.
- Downloads validam tenant, usuário e revisão no backend.
- Operações de IA, importação, aprovação e exportação geram auditoria sem gravar
  credenciais ou conteúdo sensível desnecessário.
- Uma negação de acesso não será contornada por URL, ID previsível ou referência
  contida no JSON importado.

## Primeira entrega: central + Carrossel IA

### Escopo funcional

1. Criar a rota e a entrada de navegação `Ferramentas IA` com registro das onze
   guias.
2. Integrar a implementação existente de Thumbnails sem modificá-la além do
   necessário para a navegação comum.
3. Entregar Carrossel IA de ponta a ponta:
   - criar documento vinculado ou independente;
   - herdar título, pauta, roteiro ou transcrição autorizada;
   - importar JSON validado com capa, conteúdo e CTA;
   - editar, inserir, remover e reordenar slides;
   - editar legenda e hashtags;
   - escolher formato 4:5 ou 1:1 e template institucional;
   - persistir e reabrir em outra sessão autorizada;
   - submeter à aprovação usando o fluxo existente compatível;
   - exportar PNGs ordenados, legenda e manifesto em ZIP real.
4. Registrar status e limitações na documentação do produto.

### Contrato inicial do Carrossel

O documento contém:

- briefing: origem, público, objetivo, tom e quantidade desejada;
- slides ordenados com `type` (`cover`, `content`, `cta`), título, corpo,
  destaque estruturado e imagem opcional;
- formato, template e versão do template;
- legenda, hashtags e referências à origem;
- avisos de validação que não destroem o estado atual do editor.

Asteriscos serão aceitos apenas na borda de importação e convertidos para uma
estrutura segura de destaque. Campos desconhecidos não terão efeito silencioso.
Importar três slides quando oito foram solicitados exigirá confirmação ou aviso
explícito, preservando a política escolhida no documento.

### Exportação do Carrossel

O frontend usa o mesmo documento persistido para preview e captura. O pacote
terá nomes estáveis (`01-capa.png`, `02-...png`), arquivo de legenda, manifesto
com `schema_version` e referência da revisão. Erro de fonte ou overflow aparece
antes da exportação; o sistema não trocará fonte silenciosamente.

## Fases seguintes

### Fase 2 — Identidade visual

- concluir integração/persistência de Thumbnails;
- Bordas/Molduras com preset versionado, janela ajustável, enquadramento e lote;
- compartilhar Brand Kit e templates entre as duas ferramentas.

### Fase 3 — Transcrição e cortes

- Cortes Automáticos sobre a transcrição já existente ou job reutilizável;
- candidatos com timecodes válidos, score explicável e revisão humana;
- Montagem por Falas como sequência ordenada enviada à Timeline 2;
- legenda opcional e exportação real sem cortar palavras.

### Fase 4 — Motor de vídeo

- Vídeo Studio usando o documento real da Timeline 2;
- cenas, mídia, narração importada/TTS autorizada, música e transições;
- preview e renderer interpretando a mesma estrutura;
- jobs duráveis, cancelamento, retry e export imutável.

### Fase 5 — Presets de produção

- Vídeos de Vendas e Vídeos Afiliados como presets do Studio;
- briefing e roteiro factual, CTA, variações e formato vertical;
- nenhum preço, benefício ou prova inventado pela IA.

### Fase 6 — Pesquisa e recursos avançados

- Radar de Tendências com fonte, período e evidência datada;
- Vídeos Animados sobre cenas versionadas e timeline comum;
- Dublagem IA com transcrição, tradução, glossário, voz autorizada, mixagem e
  revisão; lip-sync e clonagem ficam fora até consentimento e tecnologia serem
  validados.

## Tratamento de erros

- Falha ao carregar projeto mantém editor independente e informa a origem
  indisponível.
- JSON inválido mostra o campo problemático e preserva o documento aberto.
- Asset removido ou inacessível bloqueia somente ações dependentes e oferece
  reconexão autorizada.
- Falha em um item de lote não descarta itens concluídos.
- Export parcial nunca recebe estado `ready` nem é publicado.
- Provedor de IA indisponível não bloqueia edição manual, importação estruturada
  ou áudio fornecido pelo usuário quando esses caminhos forem aplicáveis.

## Testes e verificação

Cada fatia seguirá teste primeiro e terá, no mínimo:

- testes de domínio/schema e isolamento de tenant;
- testes de API para CRUD, revisão, autorização, importação e exportação;
- testes de frontend para navegação, estados vazios, edição e recuperação;
- teste de persistência após reload;
- teste de arquivo exportado, nomes, dimensões, conteúdo e checksum;
- lint, typecheck, build e suítes completas relevantes;
- validação funcional no navegador com material controlado;
- registro separado de implementado, testado, pendente e qualquer mudança fora
  da central.

Casos prioritários: projeto vazio; JSON inválido; três slides quando oito foram
solicitados; usuário sem acesso à origem; template atualizado; documento editado
durante export; fonte ausente; disco/empacotamento falho; reload durante job.

## Critério de conclusão da primeira entrega

A primeira entrega só termina quando um usuário autorizado conseguir abrir
Ferramentas IA, criar ou importar um carrossel, editar e reordenar slides,
fechar e reabrir sem perda, enviar a revisão pelo fluxo disponível e baixar um
ZIP verificável. Usuário sem acesso deve ser negado no backend. Thumbnails deve
continuar funcionando como antes da integração. As outras nove guias podem ser
identificadas como futuras, mas não podem simular execução.

## Fora do escopo da primeira entrega

- novos provedores pagos de IA;
- scraping automático de redes sociais ou marketplaces;
- cópia de código/prompt proprietário de WiSkills;
- clonagem de voz, lip-sync ou reconhecimento biométrico;
- publicação ou alteração de Render, Neon e GitHub;
- promoção do marco M0 sem resolver e repetir seus gates oficiais.

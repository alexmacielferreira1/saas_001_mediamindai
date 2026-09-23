# Workspace 2 — desenho aprovado

## Objetivo

Construir uma nova experiência integrada de **Pesquisa → Roteiro → Timeline** sem
substituir ou alterar o Workspace atual. A nova experiência fica disponível em
`/workspace2` durante a construção e validação.

## Referências visuais

- `C:\Users\Alex\Desktop\12665d74-487c-4454-8829-078712e57c2c.png` — Pesquisa.
- `C:\Users\Alex\Desktop\a623bfa6-ee04-4838-b421-926662e1607f.png` — Roteiro.
- `C:\Users\Alex\Desktop\3385f35e-6475-476d-a782-5c32ffd4ed84.png` — Timeline.

As imagens definem hierarquia, densidade, painéis, cores e ações. Componentes
existentes podem ser reaproveitados, mas a composição visual deve seguir essas
referências.

## Regra de preservação

- `/workspace` continua apontando para a implementação atual.
- `/workspace2` usa componentes e estado próprios.
- Nenhuma navegação existente muda antes da validação visual e funcional.
- O Workspace 2 não pode gravar sucesso falso: ações sem backend exibem estado
  local ou indisponibilidade explícita.

## Estado compartilhado

Um contêiner do Workspace 2 mantém:

- etapa ativa;
- mídia em prévia;
- conjunto de mídias selecionadas;
- roteiro ativo e seus blocos;
- projeto/timeline ativa;
- layout escolhido.

Ao avançar, as mídias selecionadas na Pesquisa continuam disponíveis no Roteiro
e na Timeline. Voltar de etapa preserva o trabalho.

## Etapa 1 — Pesquisa

Três áreas: filtros à esquerda, grade central e prévia/ações à direita. Deve
permitir selecionar várias mídias, ajustar IN/OUT, comentar, revisar,
transcrever, registrar direitos e encaminhar a seleção para roteiro, timeline,
corte, Workspace atual, produção ou download.

## Etapa 2 — Roteiro

Lista de roteiros à esquerda, editor de blocos no centro e mídias selecionadas
à direita. Blocos de mídia e texto podem ser inseridos, editados, removidos e
reordenados. O player resume o roteiro. Salvar, versões, exportar e enviar para
edição devem ter estado visível e não simular persistência.

## Etapa 3 — Timeline

Biblioteca do projeto à esquerda, player/IN/OUT no centro, propriedades à
direita e timeline multicamada abaixo. A primeira entrega oferece seleção de
clipe, propriedades básicas, controles e composição de faixas; operações de
edição devem atualizar o estado local com feedback. Persistência e renderização
real serão conectadas em bloco posterior.

## Componentes

- `Workspace2.jsx`: fluxo e estado compartilhado.
- `Workspace2Stepper.jsx`: etapas e comandos gerais.
- `Workspace2Search.jsx`: Pesquisa.
- `Workspace2Script.jsx`: Roteiro.
- `Workspace2Timeline.jsx`: Timeline.
- `workspace2Model.js`: dados iniciais e operações puras testáveis.

## Testes e aceite

- `/workspace` continua renderizando.
- `/workspace2` abre em Pesquisa.
- seleção de mídia persiste nas três etapas;
- navegação do stepper não perde roteiro;
- inclusão e remoção de blocos são testadas;
- lint, typecheck, build e cobertura configurada permanecem verdes;
- comparação visual em navegador nas três etapas antes de promover a rota.

## Fora desta primeira entrega

- substituir o Workspace atual;
- renderização de vídeo no servidor;
- integração com software NLE externo;
- publicação automática;
- migração silenciosa de dados locais para produção.

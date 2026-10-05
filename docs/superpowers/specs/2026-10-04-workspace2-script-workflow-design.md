# Workspace 2 — fluxo de pesquisa, roteiros, criação e edição

Data: 04/10/2026

## Objetivo

Reorganizar o Modo Roteiro do Workspace 2 sem descartar pesquisa, seleção de
mídias, modelos, roteiros, blocos, player, timeline, importação ou exportação já
existentes. O fluxo deve usar melhor o espaço horizontal e manter ações e
detalhes no contexto atual, evitando novas telas para inspeção de mídia ou bloco.

## Fluxo principal

1. **Pesquisa** — pesquisa e seleção inicial de mídias do Acervo.
2. **Roteiros** — catálogo de roteiros existentes, recentes, favoritos, modelos,
   filtros, ordenação e ação para continuar editando.
3. **Criar** — escolha entre roteiro em branco, mídias selecionadas, pauta ou
   modelo, seguida das informações iniciais.
4. **Roteiro** — editor em três áreas: biblioteca à esquerda, player ao centro e
   roteiro editável à direita.
5. **Timeline** — edição temporal já existente.
6. **Exportar** — preparação e exportação já existentes.

Abrir um roteiro existente na etapa **Roteiros** deve ir diretamente para
**Roteiro**. A ação **Novo roteiro** deve abrir **Criar**. A pesquisa de mídias
continua disponível nas etapas Roteiros e Criar para que a seleção possa ser
preparada antes da criação.

## Etapa Roteiros

- Destaque para “Continuar de onde parou”.
- Busca por título, programa ou assunto.
- Filtros por todos, em andamento, rascunhos, revisados e enviados para edição.
- Ordenação e visualização dos roteiros existentes.
- Atalhos para modelos já disponíveis.
- Ações `Novo roteiro`, importar e abrir/continuar um roteiro.
- A seleção de uma mídia ou roteiro abre detalhes expansíveis na própria lista,
  sem navegar para outra tela.

## Etapa Criar

- Opções: `Em branco`, `A partir de mídia`, `A partir de pauta` e `Usar modelo`.
- “A partir de mídia” utiliza a seleção preparada na Pesquisa.
- Campos iniciais reaproveitam o estado atual do projeto: título, programa,
  episódio, objetivo/responsável quando disponíveis e observações.
- Rascunhos recentes e modelos sugeridos permanecem acessíveis.
- Nesta rodada, salvamento e versionamento reutilizam o mecanismo existente;
  persistência definitiva e política `vN-1` ficam para uma rodada posterior.

## Etapa Roteiro

### Esquerda — fonte de conteúdo

- Abas `Acervo`, `Rascunhos`, `Roteiros` e `Modelos`.
- Pesquisa, filtros, seleção, clique, arrastar e adicionar mídia são preservados.
- Cada resultado pode abrir `Detalhes` logo abaixo do item.

### Centro — preview da pesquisa

- Player da mídia atualmente selecionada na pesquisa.
- Marcação IN/OUT, duração, transcrição e ação para adicionar o trecho.
- O centro não vira uma tela separada de detalhes do bloco.
- Botão centralizado no topo liga/desliga o preview.

### Direita — roteiro editável

- Painel recolhível `Informações do roteiro` no topo, contendo os campos e
  indicadores atuais.
- Lista ordenável de blocos, com adição, edição e remoção preservadas.
- Cada bloco tem botão `Detalhes`; o conteúdo expande para baixo dentro do
  próprio item e pode mostrar texto, mídia vinculada, IN/OUT, transcrição,
  informações, palavras-chave e observações aplicáveis.
- Somente um detalhe precisa ficar aberto por vez para evitar excesso visual.

### Espaço ajustável

- Com preview ligado, um divisor redimensiona centro e direita.
- Com preview desligado, a coluna direita ocupa toda a área do centro e da
  direita.
- A preferência visual pode ser mantida localmente; ela não altera o documento
  do roteiro.

## Estado e compatibilidade

- O estado atual de `project`, `blocks`, `assets`, `selectedIds`, filtros e
  preview continua sendo a fonte do fluxo.
- Modelos e roteiros existentes são reutilizados; não haverá uma segunda base de
  dados simulada apenas para a nova interface.
- As chaves locais atuais permanecem compatíveis durante esta rodada.
- Timeline e exportação continuam recebendo o mesmo documento preparado.
- A responsividade pode empilhar áreas em telas menores, preservando a ordem
  biblioteca → player → roteiro.

## Estados de interface

- Vazio, carregando, erro de Acervo e nenhum resultado permanecem explícitos.
- Alternar etapa ou abrir um item não pode apagar silenciosamente o trabalho
  atual.
- Até a política definitiva de salvamento ser conectada ao backend, ações locais
  devem ser identificadas como locais e não homologadas.

## Testes de aceite

1. O stepper apresenta Pesquisa, Roteiros, Criar, Roteiro, Timeline e Exportar.
2. Abrir roteiro existente vai ao editor; Novo roteiro vai à criação.
3. A seleção de mídia sobrevive de Pesquisa para Criar e Roteiro.
4. As quatro abas da coluna esquerda preservam os itens existentes.
5. O player central acompanha a mídia escolhida e adiciona o trecho ao roteiro.
6. O preview pode ser ocultado e o roteiro ocupa a área liberada.
7. O divisor altera a proporção entre preview e roteiro.
8. `Informações do roteiro` recolhe e expande sem perder campos.
9. `Detalhes` de mídia/bloco abre abaixo do item, sem mudar de rota.
10. Arrastar, reordenar, adicionar texto, remover, salvar, enviar à Timeline e
    exportar continuam funcionando.
11. Testes existentes permanecem verdes e novos testes cobrem a navegação e as
    expansões contextuais.

## Fora desta rodada

- Política definitiva de versões `vN-1`.
- Persistência nova de roteiros/rascunhos no backend.
- Colaboração simultânea, bloqueio distribuído ou resolução de conflitos.
- Mudanças no contrato da Timeline 2 ou da exportação.

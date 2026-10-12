# Ferramentas criativas inspiradas no ArtCraft

## Objetivo

Ampliar o MediaMind com um estúdio 3D nas Ferramentas Gráficas e quatro fluxos generativos nas Ferramentas IA, usando o ArtCraft instalado, a aplicação web e o código-fonte fornecido como referências de organização e controles, sem copiar marca, identidade ou prometer serviços externos ainda não configurados.

## Escopo aprovado

- `MM3D`: viewport escuro com grade, câmera, objetos selecionáveis, outliner, ferramentas mover/rotacionar/escalar, controles de mundo, proporção e timeline.
- `Imagem IA`: prompt, referências, modelo, proporção, resolução, qualidade e quantidade.
- `Vídeo IA`: prompt, quadro inicial/final ou referências, modelo, duração, resolução, áudio e quantidade.
- `Objeto 3D IA`: texto ou imagem de referência, modelo, qualidade e visualização do resultado.
- `Mundo 3D IA`: prompt ou referência, modelo, proporção e ambiente navegável.
- Biblioteca local compartilhada para resultados e referências desta primeira entrega.

## Princípios de interface

- Manter navegação, nomenclatura e identidade do MediaMind.
- Usar a hierarquia visual do ArtCraft como referência: navegação lateral, área principal dominante, controles compactos e ação primária junto ao prompt.
- Todos os campos e controles devem alterar o estado visível da ferramenta.
- A geração externa deve permanecer desabilitada e explicar claramente que requer um provedor configurado.
- Importações locais, seleção, transformações e navegação de viewport devem funcionar sem backend.

## Critérios de aceitação

1. MM3D aparece no seletor de Ferramentas Gráficas e abre seu workspace.
2. Objetos podem ser adicionados, selecionados e transformados por campos e pela timeline.
3. Os quatro estúdios aparecem no seletor de Ferramentas IA e preservam os 13 fluxos existentes.
4. Cada estúdio apresenta somente controles pertinentes ao seu tipo.
5. Referências locais podem ser anexadas e visualizadas.
6. A ação de gerar não simula sucesso: sem provedor, exibe estado indisponível explícito.
7. Testes automatizados cobrem navegação e interações principais.

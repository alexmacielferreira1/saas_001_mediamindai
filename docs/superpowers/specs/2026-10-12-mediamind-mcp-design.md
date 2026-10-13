# MediaMind MCP transversal — design

## Intenção

Criar uma camada única de automação para todo o MediaMind. Ela deve permitir que assistentes consultem contexto e, futuramente, executem ações controladas em MMFilm, MMEffects, Vetor, MMPhoto, MMSom, Office e Ferramentas IA sem acessar diretamente banco, storage ou segredos.

## Primeira entrega

- Um Centro MCP visível em **Ferramentas IA e Editoração**.
- Um catálogo servido pelo backend com módulos, ferramentas, escopos, risco e disponibilidade.
- Uma operação real somente leitura, `system.capabilities`, que informa as capacidades autorizadas da instalação.
- Histórico visual da chamada com correlação, duração, estado e resultado.
- Estados explícitos para adaptadores ainda não conectados; a interface não simula execução.

## Arquitetura

O backend mantém o registro canônico de ferramentas e executa apenas nomes conhecidos. A interface consulta esse registro e nunca decide permissões. Cada produto interno recebe um adaptador próprio sob o mesmo contrato. O futuro transporte MCP padrão reutilizará esse núcleo, enquanto a primeira fatia utiliza a API autenticada já existente para reduzir risco.

## Módulos

- `mmfilm`: timeline, reprodução, clipes, marcadores, IN/OUT e exportação.
- `mmeffects`: efeitos, transições, keyframes e composição.
- `vetor`: documentos vetoriais, camadas e exportação.
- `mmphoto`: imagens, recortes, ajustes e versões.
- `mmsom`: áudio, voz, limpeza, mixagem e legendas.
- `office`: documentos, planilhas, apresentações e modelos.
- `ai-tools`: geração e transformação com provedores autorizados.
- `system`: descoberta de capacidades e saúde dos adaptadores.

## Segurança e comportamento

- A primeira versão é somente leitura.
- Toda chamada exige sessão e vínculo ativo com a empresa.
- Tenant e identidade vêm da sessão, nunca dos argumentos enviados pelo agente.
- Ferramentas desconhecidas ou indisponíveis são recusadas com erro público seguro.
- Nenhuma ferramenta acessa banco ou storage diretamente; adaptadores chamam serviços internos.
- Ações futuras terão escopos próprios, idempotência, confirmação humana, auditoria append-only e possibilidade de desfazer quando aplicável.

## Evolução

1. Descoberta e inspeção somente leitura.
2. Contexto real de Workspace/MMFilm e recursos por URI.
3. Ações reversíveis de baixo risco, como criar marcador ou rascunho.
4. Edição de timeline e operações multimídia com prévia e confirmação.
5. Adaptadores locais para Premiere e DaVinci.
6. Transporte MCP padrão para clientes externos autorizados.

## Não objetivos desta entrega

- Controlar Premiere ou DaVinci.
- Expor ferramentas destrutivas.
- Alegar que módulos ainda sem adaptador estão conectados.
- Implementar RAG, fine-tuning ou acesso direto ao PostgreSQL.

# Mapa do projeto — MediaMind AI

Atualização: 27/09/2026.

## Fluxo de produção em evolução

`Workspace 2 / Pesquisa → Roteiro → Prévia → Timeline → Exportação`

## Componentes da Timeline 2

| Área | Arquivo principal | Responsabilidade |
|---|---|---|
| Rota e shell | `frontend/src/App.jsx`, `frontend/src/mediamind/Shell.jsx` | acesso protegido; rota direta compatível sem duplicar o editor no menu |
| Entrada pelo Workspace 2 | `frontend/src/mediamind/pages/Workspace2.jsx` | fluxo integrado em 5 passos e passagem do documento editado |
| Editor | `frontend/src/mediamind/pages/Timeline2.jsx` | interface e ações do usuário |
| Modelo | `frontend/src/mediamind/lib/timeline2Model.js` | operações imutáveis/não destrutivas |
| Histórico/persistência | `frontend/src/mediamind/hooks/useTimeline2Project.js` | autosave local, undo e redo |
| Exportação | `frontend/src/mediamind/components/workspace2/Workspace2Export.jsx` | formatos, render, lote, aprovação e fila |
| Player final | `frontend/src/mediamind/components/workspace2/FinalTimelinePlayer.jsx` | prévia funcional da sequência montada antes da saída |
| Referência funcional | `docs/AI_EDITA_INVENTARIO_E_MATRIZ.md` | inventário, comparação e estado recurso a recurso |
| Continuidade integral do chat | `docs/CHAT_CONTINUIDADE_AI_EDITA_2026-09-27.md` | todos os pedidos consolidados por tela, fluxo, editor, backend e aceite |

## Proteções

- Timeline e Workspace originais continuam disponíveis.
- Nenhum binário ou runtime do AI Edita integra o produto.
- A fonte de mídia não é alterada pelas operações do editor.
- Recursos dependentes de backend não são apresentados como concluídos antes da integração real.

# Mapa do projeto — MediaMind AI

Atualização: 26/09/2026.

## Fluxo de produção em evolução

`Workspace 2 / Pesquisa → Roteiro → Prévia → Timeline → Timeline 2`

## Componentes da Timeline 2

| Área | Arquivo principal | Responsabilidade |
|---|---|---|
| Rota e shell | `frontend/src/App.jsx`, `frontend/src/mediamind/Shell.jsx` | acesso protegido e menu vertical |
| Entrada pelo Workspace 2 | `frontend/src/mediamind/pages/Workspace2.jsx` | fluxo em 4 passos e preparação do documento |
| Editor | `frontend/src/mediamind/pages/Timeline2.jsx` | interface e ações do usuário |
| Modelo | `frontend/src/mediamind/lib/timeline2Model.js` | operações imutáveis/não destrutivas |
| Histórico/persistência | `frontend/src/mediamind/hooks/useTimeline2Project.js` | autosave local, undo e redo |
| Referência funcional | `docs/AI_EDITA_INVENTARIO_E_MATRIZ.md` | inventário, comparação e estado recurso a recurso |

## Proteções

- Timeline e Workspace originais continuam disponíveis.
- Nenhum binário ou runtime do AI Edita integra o produto.
- A fonte de mídia não é alterada pelas operações do editor.
- Recursos dependentes de backend não são apresentados como concluídos antes da integração real.

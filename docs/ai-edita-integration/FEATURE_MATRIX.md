# Matriz de capacidades AI Edita → MediaMind

Estados: `IMPLEMENTADO`, `ADAPTADO`, `JÁ EXISTIA`, `PARCIAL`, `PENDENTE`, `BLOQUEADO`, `NÃO APLICÁVEL`.

| Categoria | Capacidade | Destino | Estado | Próxima prova necessária |
|---|---|---|---|---|
| Timeline | mover, trim, split, excluir, zoom, snapping e playhead | Workspace 2 / Passo 4 | PARCIAL | persistência PostgreSQL e teste ponta a ponta |
| Timeline | seleção múltipla, box select, clipboard, duplicate e ripple | Passo 4 | PENDENTE | comandos reversíveis e testes |
| Timeline | reordenação/criação de tracks | Passo 4 | PENDENTE | modelo persistente |
| Player | lacunas com preto/silêncio | Timeline / exportação | IMPLEMENTADO | manter regressão |
| Player | contrato compartilhado em todas as telas | produto inteiro | PARCIAL | migrar players restantes |
| Áudio | waveform, separação e mixer | Timeline | PENDENTE | derivados/cache e mixagem |
| Legendas | presets importados | Inspector | ADAPTADO | sincronização e render final |
| Animação | keyframes e indicação visual | Inspector | PARCIAL | curvas, easing e render |
| Animação | Bezier e Graph Editor | Inspector profissional | PENDENTE | engine de propriedades |
| Efeitos | catálogo e efeitos rápidos | Timeline | PARCIAL | preview e render reais |
| Máscaras | máscaras editáveis/animáveis | Inspector | PENDENTE | modelo, canvas e render |
| Templates | templates e favoritos | Creative Engine | PENDENTE | schema versionado |
| Brand Kit | fontes, cores, logos e GC | Administração / editor | PENDENTE | domínio por empresa/programa |
| IA | prompt estruturado e EditingPlan | Assistente / Timeline | PENDENTE | provider neutro e comandos |
| IA | transcrição, auto cut, silêncio, hook e B-roll | Creative Engine | PENDENTE | jobs e revisão humana |
| Exportação | MP4 e central do Passo 5 | Workspace 2 | PARCIAL | fila durável e derivados |
| Exportação | XML/EDL/OTIO e NLEs | Passo 5 | PARCIAL | relink e checksums |
| Projetos | Workspace → Timeline → exportação | percurso MVP | PARCIAL | backend versionado e nova sessão |
| Tema | Claro/Escuro/Sistema | produto inteiro | PENDENTE | tokens e preferência |
| Atalhos | comandos contextuais e modal | produto inteiro | PARCIAL | catálogo central |
| UX | menus, tooltips e command palette | editor/produto | PARCIAL | ações e acessibilidade |
| UX | painéis redimensionáveis | Workspace/Timeline | PENDENTE | layout persistente |
| UX | modo rápido/profissional | editor | PENDENTE | mesma engine/projeto |
| Aprovação | comentários por tempo/range/elemento/track | revisão | PENDENTE | domínio persistente |
| Performance | virtualização, proxies, cache e workers | editor | PENDENTE | métricas e limites |
| Administração | providers, permissões e feature flags | Administração | PENDENTE | backend e auditoria |

Uma linha só muda para `IMPLEMENTADO` quando UI, estado, ação real, persistência quando aplicável, erro, integração e teste mínimo funcionam.

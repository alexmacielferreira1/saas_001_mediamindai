# Matriz de migração dos testes legados

Fonte preservada e somente leitura: `C:\Users\Alex\Desktop\MediaMindAI\backend\tests`.

Inventário em 19/09/2026: 23 módulos e 452 funções `test_*`. A contagem anterior de
453 incluía uma declaração de classe. O objetivo não é copiar testes mecanicamente:
cada comportamento ainda válido deve ser reimplementado contra a arquitetura local;
dependências específicas do Base44 devem ganhar um equivalente local ou uma decisão
documentada de não aplicabilidade.

| Área legada | Testes | Situação na reconstrução | Prioridade de migração |
| --- | ---: | --- | --- |
| Autenticação | 13 | Sessão local básica coberta; recuperação de senha pendente | Crítica |
| Proteção contra força bruta | 12 | Bloqueio por conta portado e coberto; casos distribuídos e observabilidade avançada pendentes | Crítica |
| Regras de acesso | 5 | Isolamento por tenant e papéis básicos cobertos; matriz completa pendente | Crítica |
| Grupos de permissão | 16 | Núcleo tenant-scoped e CRUD HTTP seguro cobertos; vínculo administrativo grupo↔membership, catálogo inicial e prova PostgreSQL pendentes | Crítica |
| Usuários | 37 | Identidade base coberta; CRUD e políticas pendentes | Alta |
| Aplicação/saúde | 4 | Coberto na fundação local | Alta |
| Dependências | 1 | Coberto por verificações automatizadas; auditoria contínua | Alta |
| Upload de ativos | 16 | Pendente | Alta |
| Ativos | 44 | Pendente | Alta |
| Pacotes de ingestão | 10 | Pendente | Alta |
| Pipeline de IA | 62 | Pendente | Alta |
| Projetos | 13 | Pendente | Alta |
| Tarefas | 46 | Pendente | Alta |
| Workspaces | 14 | Pendente | Alta |
| Layouts de workspace | 3 | Pendente, sem alterar o visual aprovado | Alta |
| Bibliotecas | 13 | Pendente | Média |
| Clipes | 23 | Pendente | Média |
| Scripts | 38 | Pendente | Média |
| Publicações | 22 | Pendente | Média |
| Contas sociais | 17 | Pendente | Média |
| Relatórios | 18 | Pendente | Média |
| Pesquisas salvas | 6 | Pendente | Média |
| Progresso | 7 | Pendente | Média |

## Gates obrigatórios por área

1. Testes de comportamento escritos ou portados antes da implementação.
2. Isolamento entre empresas validado em todo recurso com dados de cliente.
3. Casos de sucesso, autorização negada, entrada inválida, conflito e falha de
   dependência cobertos quando aplicáveis.
4. Cobertura de 100% de linhas, decisões, funções e instruções do código próprio.
5. Testes de integração com PostgreSQL para persistência, migrações e restrições.
6. Nenhum teste removido apenas para atingir a meta de cobertura.

Esta matriz deve ser atualizada junto com cada domínio reconstruído.

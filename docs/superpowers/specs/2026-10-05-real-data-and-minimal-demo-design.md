# Dados reais e demonstração mínima no MediaMind AI

**Data:** 05/10/2026

**Produto principal:** MediaMind AI (`001_mediamindai`)

**Integração secundária:** Central (`000_central`)
**Estado:** especificação para revisão

## 1. Objetivo

Impedir que dados simulados sejam apresentados como fatos reais sem quebrar as telas e os fluxos existentes. O produto usará dados persistidos quando a capacidade estiver conectada ao backend, mostrará estados vazios ou erros explícitos quando não houver dados reais e manterá apenas um conjunto pequeno, determinístico e identificável de registros demonstrativos para prévias locais.

Esta entrega não apaga legado, não altera produção, não ativa provedores externos e não substitui dados reais. Ela complementa a especificação de conclusão do backend administrativo, `REBUILD_DESIGN.md`, `LEGACY_FINDINGS_REVIEW.md` e `VIDEO_AI_PROVIDER_STRATEGY.md`.

## 2. Situação confirmada

Home, Acervo, Ingest, Workspace, Gestão e Administração ainda misturam APIs reais, `localStorage`, coleções estáticas e fallbacks demonstrativos. Algumas capacidades já existem no backend, mas partes da interface ainda podem trocar uma falha de API por conteúdo plausível. O backend já restringe o seed de contas demo a `local` e `test`; essa proteção será preservada.

## 3. Política de origem

Cada área visível declarará uma origem:

1. **REAL:** resposta confirmada de API persistente e autorizada;
2. **VAZIO:** API respondeu corretamente, mas não há registros;
3. **INDISPONÍVEL:** a fonte real falhou, expirou ou não está configurada;
4. **DEMONSTRAÇÃO:** dados sintéticos carregados em ambiente ou modo explicitamente demonstrativo.

Regras obrigatórias:

- falha real nunca muda automaticamente para demonstração;
- ausência de registros nunca é preenchida com números inventados;
- custos, consumo, saúde, alertas e totais excluem registros demo;
- a interface identifica demonstração junto ao dado;
- a origem vem do adaptador de dados, não de suposição visual;
- modo autenticado normal não lê fixtures como fallback;
- fixtures de teste permanecem isoladas da aplicação.

## 4. Catálogo demonstrativo mínimo

Haverá um único catálogo lógico `demo_seed_v1`, repetível e reutilizado pelos módulos que precisarem de uma prévia coerente. Ele terá o menor número de entidades necessário para navegar pelos fluxos aprovados, sem coleções diferentes por tela.

Cada registro persistido pelo catálogo terá identificador estável, `is_demo = true`, referência a `demo_seed_v1`, tenant exclusivamente demonstrativo e conteúdo claramente fictício. A criação será idempotente.

Quando uma tabela ainda não puder receber os campos com segurança, um manifesto associará identificadores estáveis ao catálogo. A migração definitiva será aditiva. O seed só poderá rodar em `local` e `test`, nunca automaticamente por uma tela.

## 5. Limpeza e preservação

A remoção futura será seletiva por `demo_dataset`, nunca por texto, data aproximada ou exclusão ampla. Antes de remover, o processo mostrará contagem e tipos afetados. Dados reais, documentação, ZIPs, Word, Base44, históricos e outros tenants ficam preservados.

Desligar um fallback significa retirá-lo do fluxo normal, não apagar imediatamente o arquivo. Exclusão física só ocorrerá depois de comprovar que não há consumidores e mediante autorização adequada.

## 6. Inventário tela por tela

O inventário operacional registrará para cada tela: rota, componente, fonte atual e esperada, leituras, escritas, backend existente ou pendente, comportamento para vazio/erro/permissão, presença de demo, testes e estado `PENDENTE`, `EM_EXECUCAO`, `BLOQUEADO` ou `CONCLUIDO`.

A ordem prioriza risco de confusão:

1. indicadores, saúde, custos, integrações e modelos de IA;
2. usuários, acessos e auditoria;
3. Acervo, Ingest e processamento;
4. Workspace e edição;
5. demais áreas administrativas demonstrativas.

Uma tela só fica concluída quando todas as ações visíveis têm fonte conhecida, estados vazio/erro/permissão funcionam e nenhuma falha produz dados falsamente plausíveis.

## 7. APIs e IA

A primeira etapa não armazenará nem ativará chaves externas. A interface exibirá somente `NÃO CONFIGURADO`, `NÃO TESTADO`, `CONECTADO`, `INDISPONÍVEL` ou `DEMONSTRAÇÃO`. `CONECTADO` exige teste real recente.

`AI_PROVIDER_NOT_CONFIGURED` será mostrado como não configurado, nunca como sucesso. Ollama poderá ser conectado em etapa própria com teste real de conectividade; sua disponibilidade não prova que uma tarefa de mídia foi executada.

## 8. Central

A Central não acessará banco nem segredos do MediaMind. Receberá pela API administrativa somente informações agregadas, sanitizadas e reais. Métrica ausente aparecerá como `não disponível`, sem estimativa ou fixture.

Central e MediaMind podem usar o mesmo nome de catálogo demo, mas continuam em bancos e tenants independentes. Não haverá sincronização automática de seeds.

## 9. Frontend e compatibilidade

Os adaptadores retornarão um envelope uniforme com `data`, `source`, `generated_at` e erro sanitizado. Componentes compartilharão estados de carregamento, vazio, indisponibilidade, falta de permissão e demonstração.

A migração será progressiva: caracterizar o comportamento atual com testes, trocar a origem da área, preservar layout e navegação, desligar o fallback silencioso depois dos testes e manter o código antigo fora da execução até a revisão final. Não será criado outro sistema genérico se os adaptadores atuais puderem ser estendidos com segurança.

## 10. Segurança e erros

- autorização e isolamento por tenant permanecem no servidor;
- falta de permissão não aparece como lista vazia;
- mensagens não expõem segredos, tokens ou respostas integrais de provedores;
- escrita só confirma sucesso após persistência;
- mutações demo são recusadas fora do tenant demo;
- seeds fora de `local/test` falham explicitamente;
- métricas demo não entram em custos, saúde ou auditoria reais.

## 11. Testes

Cada tela migrada terá testes com dados reais, resposta vazia, API indisponível, falta de permissão, isolamento por tenant, ausência de fixture no modo autenticado e rótulo demo quando aplicável.

O seed terá testes de idempotência, recusa em produção, exclusão dos agregados reais e seleção segura para limpeza. A limpeza será testada para garantir que registros reais sobrevivam. Suítes existentes, lint e build devem passar. Deploy, Neon, Render e publicação remota ficam fora desta especificação.

## 12. Entrega incremental

1. inventariar telas e fontes atuais;
2. definir o envelope de origem e estados compartilhados;
3. consolidar `demo_seed_v1` sem remover seeds antigos;
4. corrigir indicadores, integrações e IA;
5. corrigir usuários, acesso e auditoria;
6. migrar Acervo e Ingest;
7. migrar Workspace e demais áreas;
8. validar a Central com agregados reais;
9. emitir relatório dos fallbacks desconectados para limpeza futura.

Cada bloco será pequeno, reversível e testado antes do seguinte. Um bloqueio não autoriza preencher a tela com dados simulados.

## 13. Critérios de aceite

- nenhuma falha autenticada é mascarada por demonstração;
- qualquer dado demo visível está identificado e pertence ao catálogo mínimo;
- demonstrações não contaminam totais, custos, saúde ou auditoria;
- vazio, indisponível e sem permissão são estados distintos;
- seeds são idempotentes e limitados a `local/test`;
- registros demo podem ser identificados e removidos seletivamente;
- dados reais, legado e documentação importante são preservados;
- Central e MediaMind continuam isolados;
- nenhuma ação externa ou de produção ocorre sem autorização específica.

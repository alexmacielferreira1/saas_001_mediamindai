# Administração 2 — matriz normativa das referências visuais

Atualizado em 02/10/2026. Fontes: `MediaMind_AI_Especificacao_Administracao_e_Roteiro_2.docx` e as 26 imagens em `C:\Users\Alex\Downloads\melhorar mediamind290926`.

## Regra de execução

As imagens de Administração são a fonte principal de verdade para layout, hierarquia, densidade, componentes e interação. Números, nomes, e-mails, datas, endereços IP, contagens e eventos visíveis nas imagens são exemplos e não podem ser fixados como produção. Quando um dado ou endpoint ainda não existe, a interface deve manter a composição da referência com estado vazio, indisponível ou demonstração claramente identificado, sem simular persistência.

`Workspace2` e os Roteiros dentro dele estão protegidos: não alterar editor, modelos, blocos, seleção de mídia, timeline, rotas, dados ou fluxos já aprovados. As referências de Roteiro ficam preservadas para consulta e não autorizam refazer o Workspace.

Funcionalidades reais já existentes na Administração também são protegidas. Se uma capacidade atual não tiver posição clara na foto, ela deve ser mantida em uma subguia contextual com nome descritivo e sufixo `+1`; não pode ser apagada para obter fidelidade visual. Duplicações visuais podem ser consolidadas somente quando apontarem para a mesma operação e o mesmo contrato de dados.

## Matriz imagem por imagem e guia por guia

| Fonte | Guia ou subtela | Estrutura obrigatória | Interações e estados | Tratamento atual esperado |
|---|---|---|---|---|
| `ChatGPT Image Sep 29, 2026, 10_33_42 PM.png` | Visão Geral | navegação horizontal; seis KPIs; ações rápidas; alertas; últimas ações; resumo de segurança | KPIs e alertas abrem a guia correspondente no mesmo contexto; ações sem backend ficam indisponíveis | refazer a composição atual para a grade da foto; dados reais ou `—` |
| `ChatGPT Image Sep 29, 2026, 10_34_23 PM.png` | Usuários — lista | KPIs, convites/acessos expirando, filtros densos, tabela paginada e ações | selecionar usuário abre detalhe contextual; filtros preservam seleção válida; tabela vira cartões em tela estreita | refazer lista e filtros; preservar API real e modo demo explícito |
| `ChatGPT Image Sep 29, 2026, 10_34_31 PM.png` | Usuário — detalhe e guia Acessos | cabeçalho completo; ações; guias; acesso efetivo; escopo; atividade; módulos; permissões críticas; segurança | detalhes no mesmo contexto; subseções internas não redirecionam; suspender continua confirmado e auditado | agregar o que já funciona; não inventar MFA, sessões ou histórico |
| `ChatGPT Image Sep 29, 2026, 10_33_49 PM.png` | Acessos por Função | cards em duas colunas, chips de telas, filtros, ações, usuários e configurador por IA | editar, duplicar, ver/aplicar usuários e exportar apenas quando houver operação real; IA sempre exige revisão | preservar `AdminAcessosPage`; envolvê-la na composição da referência sem quebrar sua lógica |
| `ChatGPT Image Sep 29, 2026, 10_34_47 PM.png` | Perfis e Funções | lista mestre lateral; perfil selecionado; resumo; funções; módulos; matriz resumida; histórico | troca de perfil atualiza detalhe; usuário vinculado abre subdetalhe com retorno; criar/editar ficam desabilitados sem endpoint | reconstruir como mestre–detalhe e usar grupos/permissões reais |
| `ChatGPT Image Sep 29, 2026, 10_33_58 PM.png` | Permissões | filtros, matriz módulo × ação, resumo do perfil, origem, críticas e alterações recentes | seleção de módulo/ação mostra origem e escopo; estados permitido/negado/herdado não são clicáveis sem mutação real | manter leitura real; substituir números não comprovados por `—` |
| `ChatGPT Image Sep 29, 2026, 10_34_06 PM.png` | Equipes Setores e Unidades | lista mestre; detalhe da equipe; responsável; membros; funções; módulos; unidades; setores | equipe e membro selecionáveis; retorno preserva equipe e busca; criar/editar indisponível sem backend | reconstruir mestre–detalhe; demonstrativos claramente marcados |
| `ChatGPT Image Sep 29, 2026, 10_34_16 PM.png` | Formulários — lista e detalhe | lista lateral; resumo; guias; prévia; mapeamento; publicação; respostas | cada formulário abre sua própria prévia e campos; não basta trocar título | implementar prévias específicas conforme seção abaixo |
| `ChatGPT Image Sep 29, 2026, 10_34_39 PM.png` | Importação de Dados | KPIs; stepper; upload/preview; mapeamento; validação; erros; ações | erros e colunas abrem detalhe local; nenhuma importação ocorre no upload; fluxo real fica desabilitado até API | reproduzir estrutura completa como prévia honesta, sem falso sucesso |
| `ChatGPT Image Sep 29, 2026, 10_34_54 PM.png` | Segurança — política | cinco KPIs; abas de política; MFA por perfil; regras; sessões; tentativas; histórico; acessos expirando | guias internas preservam contexto; ações de sessão/política exigem endpoints e autorização | fonte detalhada complementar |
| `ChatGPT Image Sep 29, 2026, 10_35_00 PM.png` | Segurança — visão operacional | composição mais densa com MFA, regras, sessões, tentativas, histórico e acessos expirando | variante principal; deve incorporar os controles úteis da imagem anterior sem duplicar blocos | refazer tela atual conforme esta variante; dados ausentes viram estados explicativos |
| `ChatGPT Image Sep 29, 2026, 10_33_34 PM.png` | Mapa mínimo da Administração | visão geral, usuários, detalhe, acesso, perfis, equipes, formulários e importação | funciona como conferência de cobertura, não como layout isolado | nenhuma dessas subtelas pode ficar apenas como card estático |

## Formulários personalizados por tipo

Cada seleção precisa alterar campos, descrição, entidade, mapeamento e prévia. Compartilhar o mesmo formulário e trocar somente o título é divergência crítica.

| Tipo | Entidade e campos mínimos da prévia |
|---|---|
| Cadastro de convidado | `Person`; nome completo, e-mail, telefone, empresa, CPF e observações; publicação pública, validade e respostas recentes |
| Autorização de imagem e voz | `Person`/consentimento; nome, documento, contato, finalidade, período, canais autorizados, restrições, aceite e assinatura |
| Novo programa | `Program`; nome, descrição, canal, categoria, periodicidade, responsáveis, status e identidade visual disponível |
| Nova produção | `Production`; título, programa, tipo, responsável, equipe, janela de produção, prioridade, status e observações |
| Solicitação de mídia | `AssetRequest`; solicitante, produção/programa, tipo de mídia, descrição, prazo, prioridade, formato e anexos |
| Cadastro de fornecedor | `Organization`/fornecedor; razão social, nome, documento, contato, especialidade, dados operacionais e status |

## Elementos transversais

- Tema escuro e linguagem azul/ciano da referência, com verde, amarelo e vermelho semânticos.
- Cards compactos, tabelas densas, chips, painéis e tipografia consistentes com o produto.
- Foto real apenas quando vier do registro; ausência usa iniciais. Nenhum retrato genérico apresentado como pessoa real.
- Todo item que parece clicável deve selecionar, expandir, abrir detalhe ou estar visivelmente desabilitado com motivo.
- Listas e filtros permanecem visíveis ao abrir detalhes em desktop; em tela estreita, o painel é responsivo e devolve foco ao item de origem.
- Estados obrigatórios: carregando, vazio, erro, sem permissão, indisponível e demonstração.

## Gates de aceite visual

- [ ] Todas as 12 referências de Administração acima possuem implementação ou bloqueio real documentado.
- [ ] Cada guia de usuário funciona no próprio contexto e não perde filtros ou seleção.
- [ ] Cada tipo de formulário apresenta campos e mapeamento próprios.
- [ ] Desktop e tela estreita foram comparados com evidência por guia.
- [ ] Nenhum número, foto, sessão, tentativa, permissão ou histórico foi inventado como dado real.
- [ ] `Workspace2` e seus Roteiros passaram nos testes existentes sem alteração funcional.
- [ ] Acessos por Função preservou a lógica existente.
- [ ] Toda funcionalidade anterior sem posição na referência foi preservada em subguia `+1` e testada.
- [ ] Nenhum botão ativo ficou sem ação real.

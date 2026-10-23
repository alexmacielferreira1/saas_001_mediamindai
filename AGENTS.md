# Rotina de implementação e testes

## Revisão contínua de confiabilidade

- Alex autorizou revisão e correções locais autônomas em todo o MediaMind: procurar falhas de segurança, estabilidade, integridade, isolamento entre empresas, persistência e recuperação de dados, além de regressões funcionais.
- Em cada bloco de implementação, revisar os caminhos afetados: autorização no servidor, exposição de dados/segredos, validação de entrada, falhas parciais, concorrência, duplicação, perda por sobrescrita e possibilidade de recuperação. Expandir a investigação para dependências relacionadas quando houver evidência de risco.
- Corrigir causas comprovadas, acrescentar testes relevantes e registrar evidências no relatório. Trabalhar em blocos pequenos; não declarar o sistema inteiro seguro ou 100% coberto com base em checagens parciais.
- Não pedir confirmação para correções locais reversíveis já autorizadas. Preservar trabalho concorrente, dados existentes e legado. Mudanças destrutivas, serviços externos e publicação continuam sujeitas às instruções superiores e ao escopo autorizado.
- O acompanhamento automático deve continuar a revisão por blocos quando houver mudanças ou falhas acionáveis, sem repetir testes do mesmo conteúdo e sem usar execução forçada sem pedido explícito.
- A mesma rotina periódica deve analisar autorização e isolamento entre empresas, validação de arquivos e caminhos, exposição de dados/segredos, limpeza de gravações incompletas, preservação após falhas e recuperação. Incluir testes desses cenários em cada funcionalidade relacionada; verificar também lint, formatação, tipos e build, registrando os resultados separados no relatório combinado.
- Revisões periódicas podem ser feitas sem executar testes novamente: comparar alterações, ler evidências e registrar lacunas. Testes de restauração de backup, concorrência e integração com serviços precisam de ambiente local isolado e dados de teste; nunca usar produção para esses exercícios nem afirmar que passaram sem execução comprovada.

Aplicam-se também as instruções de AGENTS.md da raiz do HUB e seus documentos normativos.

- Toda nova funcionalidade ou correção deve incluir testes equivalentes que verifiquem o comportamento e as regressões relevantes.
- Executar testes focados durante a alteração. Ao concluir um bloco funcional, executar `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-report.ps1` a partir deste produto, ou `npm run test:all` dentro de frontend.
- O comando registra ambos os resultados em `test-results/<execucao>/report.txt`, com cobertura e resumo. `test-results/latest.json` aponta para a execução mais recente e distingue execução em andamento, concluída ou interrompida.
- Ler o relatório concluído, investigar falhas, corrigir a causa e repetir a verificação. Não ignorar testes, reduzir gates ou excluir código para elevar artificialmente a cobertura. Meta solicitada: 100% do frontend e backend; sempre informar o escopo realmente medido.
- Não iniciar execuções completas concorrentes nem interpretar um relatório ainda em andamento como resultado final.
- Comparar o conteúdo dos arquivos com `test-results/last-tested-files.json` antes de repetir testes. Sem alterações, apenas ler o relatório anterior. `changes.json` e `files-before.json` registram os arquivos de cada execução. Usar `-Force` somente por pedido explícito do usuário; uma falha de cobertura por si só não autoriza repetir código idêntico.
- Preservar relatórios históricos, alterações de outros chats e credenciais. Os relatórios são locais e ignorados pelo Git.
- A nova configuração de IA e os endpoints associados permanecem com o outro chat enquanto ele estiver trabalhando nesse escopo. Registrar falhas ali sem editar esses arquivos concorrentes.
- Esta rotina não autoriza commit, push ou deploy automáticos. A publicação será feita pelo chat responsável após consolidar o trabalho.

## Revisão de qualidade e segurança

- Roteiro padrão do HUB: `docs/REVISAO_QUALIDADE.md`. Rodar antes de publicar, ao fechar marco e após blocos que mexam em auth, permissões, dados de empresas, uploads, integrações, IA ou cobrança.
- Skills do projeto em `.claude/skills/`; plugins de segurança (Trail of Bits) declarados em `.claude/settings.json`. Outros agentes seguem o mesmo roteiro pelo documento.
- Relatórios de auditoria ficam em `docs/AUDITORIA_QUALIDADE_<data>.md`. Correções seguem a rotina de testes deste arquivo: teste que falha, correção, teste que passa, um item por vez.

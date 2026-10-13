# Plano de integração Adobe Premiere MCP ao MediaMind

**Data:** 12/10/2026
**Estado:** proposta técnica para validação; nenhum pacote externo instalado ou executado.

## Objetivo

Criar uma ponte local segura entre MediaMind, Adobe Premiere Pro, Codex e Claude. O MediaMind deve continuar sendo a origem dos projetos, mídias, permissões e auditoria; o MCP traduz intenções em consultas ou operações no Premiere.

## Material analisado

### `Adobe_Premiere_Pro_MCP-main.zip`

- Pacote `adobe-premiere-pro-mcp` 1.2.9, MIT, Node 20+.
- Catálogo declarado de 283 ferramentas.
- Ponte CEP é indicada como produção; UXP ainda é experimental.
- Inclui descoberta progressiva (`search_tools`, `get_tool_schema`, `invoke_tool`), verificação de conexão, plugin para Codex e Claude e documentação de segurança.
- Bom candidato para compatibilidade com Premiere 2020+ e como referência do adaptador CEP.

### `premiere-pro-mcp-main.zip`

- Pacote `premiere-pro-mcp` 1.24.0, MIT, Node 20.19+.
- Arquitetura UXP-first, com ponte/relay local e CEP opcional para lacunas.
- Possui perfis de ferramentas, descoberta progressiva, contratos de confirmação, recibos, recuperação, testes extensos e integrações para Codex e Claude.
- É o melhor candidato técnico para a base moderna do adaptador Adobe, sujeito a testes com a versão real do Premiere instalada.

### `tieline-main.zip`

- Não controla Adobe. É um MCP de contexto de produto, contratos, critérios de aceite, topologia de código e impacto de mudanças.
- Pode ser útil posteriormente para dar contexto de engenharia ao Codex/Claude e proteger contratos do HUB.
- Há inconsistência de licença: `package.json` declara MIT, enquanto o arquivo `LICENSE` contém AGPL-3.0. Não incorporar ou redistribuir até a licença ser esclarecida.

### Registro LobeHub

- O registro encontrado aponta para uma versão 1.0.0/269 ferramentas e possui metadados incompletos (`Tools`, `Resources` e `Prompts` aparecem como falsos).
- O comando de registro substitui credenciais previamente salvas do Market CLI.
- Portanto, usar o LobeHub apenas para descoberta. Não instalar por esse registro nem registrar credenciais até confirmar conta, origem e pacote exato.

## Arquitetura proposta

```text
Codex / Claude / MediaMind Web
              |
       MediaMind MCP Gateway
  autenticação, empresa, políticas, auditoria
              |
     MediaMind Local Bridge (Windows)
  sessão local, fila, confirmação, recibos
              |
       Adaptador Adobe Premiere
       UXP preferido / CEP fallback
              |
        Adobe Premiere Pro
```

O backend publicado no Render não deve tentar controlar diretamente o Premiere instalado no computador. A operação acontece em uma ponte local autenticada, e o backend mantém identidade do projeto, políticas e histórico.

## O que reutilizar

1. Descoberta progressiva de ferramentas, evitando enviar centenas de esquemas ao modelo.
2. Adaptador UXP e protocolo de ponte local do projeto 1.24.0.
3. Adaptador CEP do projeto 1.2.9 como compatibilidade e referência.
4. Verificação de conexão, leitura do projeto, sequências, trilhas, clipes e mídias.
5. Checkpoints, leitura posterior da alteração, recibos e recuperação.
6. Configurações locais para Codex e Claude apontando para o mesmo servidor MediaMind MCP.
7. Testes de segurança de caminhos, injeção de script, vínculo ao host e operações de timeline.

## O que personalizar

- Namespace próprio: `mediamind.premiere.*`.
- Identidade compartilhada entre projeto MediaMind, asset do Acervo e item do Premiere.
- Interface em português no Centro MCP.
- Perfis por usuário, função, empresa e projeto.
- Fluxo `inspecionar -> planejar -> pré-visualizar -> confirmar -> executar -> verificar -> desfazer`.
- Histórico com usuário, projeto, ferramenta, argumentos saneados, resultado e correlação.
- Receitas editoriais do MediaMind: montagem por roteiro, sincronização de entrevistas, B-roll, legendas, loudness, formatos sociais e exportação.
- Seleção de mídia e trechos vindos do Workspace/Acervo.

## O que não reutilizar diretamente

- Branding, telemetria ou atualizador dos projetos externos.
- Instalações que alterem configurações do Codex/Claude sem revisão.
- Catálogo plano com centenas de ferramentas carregadas de uma vez.
- Execução arbitrária de ExtendScript, shell ou caminhos fora dos projetos autorizados.
- Operações destrutivas sem checkpoint, confirmação e possibilidade de recuperação.
- Código do Tieline enquanto a licença estiver contraditória.

## Primeira superfície de ferramentas MediaMind

### Somente leitura

- `mediamind.premiere.status`
- `mediamind.premiere.project.inspect`
- `mediamind.premiere.sequence.inspect`
- `mediamind.premiere.timeline.inspect`
- `mediamind.premiere.media.match`
- `mediamind.premiere.export.readiness`

### Planejamento sem alteração

- `mediamind.premiere.edit.plan`
- `mediamind.premiere.edit.preview`
- `mediamind.premiere.export.plan`

### Escrita controlada, somente após os gates

- `mediamind.premiere.sequence.create`
- `mediamind.premiere.timeline.apply_plan`
- `mediamind.premiere.captions.apply`
- `mediamind.premiere.audio.normalize`
- `mediamind.premiere.export.execute`
- `mediamind.premiere.operation.undo`

## Fases de implementação

### Fase 0 — auditoria e laboratório

- Fixar versões e hashes dos dois projetos Premiere.
- Executar análise de dependências e segurança sem instalar globalmente.
- Confirmar versão do Premiere e disponibilidade de UXP.
- Criar projeto Premiere descartável para testes.

### Fase 1 — conexão somente leitura

- Criar `MediaMind Local Bridge` isolado.
- Conectar UXP ao Premiere; ativar CEP apenas quando necessário.
- Integrar `status`, projeto, sequência e timeline ao Centro MCP.
- Configurar Codex e Claude com o mesmo servidor local, em perfil de leitura.

### Fase 2 — plano e confirmação

- Gerar planos de edição sem executá-los.
- Exibir alterações previstas no Centro MCP.
- Criar checkpoint/backup e confirmação humana para qualquer escrita.
- Registrar recibo e verificar o estado real depois de cada comando.

### Fase 3 — edição controlada

- Habilitar criação de sequência, colocação e corte de clipes, legendas, áudio e exportação.
- Adicionar desfazer/recuperação e limites por função.
- Validar receitas reais de MMFilm usando cópias de projetos.

### Fase 4 — expansão transversal

- Adaptadores MMEffects/After Effects, MMPhoto/Photoshop, Vetor/Illustrator, MMSom/Audition e Office.
- Cada adaptador mantém o mesmo contrato de descoberta, permissão, confirmação, recibo e auditoria.

## Gates de segurança

- Tráfego local autenticado e restrito a `localhost`.
- Allowlist de pastas e projetos; proteção contra travessia e links simbólicos.
- Nenhum segredo dentro do repositório ou prompt.
- Ferramentas classificadas como leitura, escrita reversível ou destrutiva.
- Confirmação obrigatória para escrita e exportação; bloqueio padrão para destruição.
- Backup/checkpoint antes da primeira alteração de cada operação.
- Verificação do estado no Premiere depois da execução; não confiar apenas no retorno do script.
- Perfis compactos e descoberta progressiva para reduzir custo e escolhas erradas do modelo.

## Próximo bloco recomendado

Construir a Fase 0 e a Fase 1 usando o projeto `premiere-pro-mcp` 1.24.0 como referência UXP e `adobe-premiere-pro-mcp` 1.2.9 como fallback CEP. A primeira demonstração deve mostrar, no Centro MCP, a conexão real com o Premiere e a leitura de projeto, sequência, trilhas e clipes, sem modificar nada.

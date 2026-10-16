# Plano de implementação — CLIPSFREE2 real

Data: 14/10/2026

## Objetivo

Entregar uma esteira de corte profissional, independente do `CLIPSFREE`, para transformar mídia autorizada de uma empresa em clipes revisáveis e exportáveis. O alvo é capacidade funcional própria, não cópia do OpusClip.

## Não objetivos

- Copiar código, marca, layout, textos, imagens, modelos ou regras internas de terceiros.
- Declarar pontuação, legenda, render, reenquadramento ou publicação como concluídos antes de haver execução real e testes.
- Alterar `CLIPSFREE`, seus componentes, seu rascunho ou seus registros.
- Publicar, usar Render/Neon, consumir serviços pagos ou criar credenciais sem autorização posterior explícita.

## Arquitetura proposta

### Isolamento

- Rota: `/clipsfree2`.
- Frontend: `frontend/src/mediamind/pages/ClipsFree2.jsx` e pasta exclusiva `components/clipsfree2/`.
- Cliente HTTP: `frontend/src/api/clipsfree2.js`.
- API: prefixo `/api/v1/clipsfree2` e módulo backend próprio `app/clipsfree2/`.
- Registros tenant-scoped com tipos próprios: `ClipsFree2Job`, `ClipsFree2Transcript`, `ClipsFree2Candidate`, `ClipsFree2Caption`, `ClipsFree2Export` e `ClipsFree2Attempt`.
- Rascunho protegido com chave própria por empresa/usuário; nenhum acesso à chave de rascunho do `CLIPSFREE`.
- Interface em português do Brasil por padrão, com inglês como idioma alternativo. Os contratos e registros persistem códigos de estado estáveis, sem depender de texto traduzido.

### Esteira real

```text
ativo autorizado ou URL autorizada
  → validação/probe do vídeo
  → extração de áudio
  → transcrição com segmentos e palavras temporizados
  → seleção de candidatos com evidência
  → revisão no player e ajuste IN/OUT
  → edição de legendas
  → renderização de versão
  → exportação vinculada ao ativo original
```

Cada seta é um estado persistido. Falha, cancelamento e indisponibilidade encerram o estágio sem gerar sucesso, candidato, legenda ou exportação fictícios.

## Blocos de entrega

### 0. Evidência autenticada antes do código

Com conta de teste e vídeos próprios, observar com REA uma jornada por vez: upload, configuração, processamento, cartões de cortes, revisão, legendas e exportação. Registrar para cada etapa controles, estados, saídas e limitações. Não automatizar login, não enviar senha e não tentar superar Cloudflare.

### 1. Fundação isolada e validação de mídia

Criar rotas, contratos e registros `ClipsFree2`. Implementar criação idempotente de trabalho por ativo/perfil, autorização por tenant, limite/MIME/duração, checksum e probe FFmpeg. Testes: outro tenant não lê o trabalho; arquivo sem áudio falha; repetição não duplica trabalho; original é preservado.

### 2. Transcrição real e progresso durável

Extrair áudio no servidor e executar adaptador de transcrição configurado por empresa. Persistir segmentos/palavras com tempos; exibir estado e polling. Testes: provedor ausente resulta em `unavailable`; segmentos inválidos são recusados; retomada conserva transcript anterior válido; cancelamento não apaga o original.

### 3. Candidatos fundamentados

Analisar apenas janelas da transcrição persistida. Cada proposta deve mapear para evidência, respeitar duração e registrar dimensões editoriais/racional. Testes: sem evidência não há candidato; limites de intervalo são aplicados; pontuação é determinística; outro tenant não acessa candidato por ID.

### 4. Mesa de revisão, timeline multicamada e legendas

Criar player com busca do intervalo, IN/OUT, transcrição sincronizada, timeline multicamada e edição de cues. Legendas automáticas só derivam de palavras temporizadas existentes. A edição textual deve oferecer explicitamente: remover somente a legenda ou remover o trecho de mídia correspondente; nenhum modo pode ser implícito. Cada camada tem ordem, tipo e intervalo auditáveis; a remoção preserva as versões anteriores para desfazer. O posicionamento de legenda deve ser versionado por keyframes: uma posição definida em um tempo vale dali em diante, até o próximo keyframe, sem alterar trechos anteriores. A primeira versão deve prever tipos extensíveis de camada (por exemplo B-roll, texto e áudio/voiceover), ainda que não os renderize até haver adaptador real. Testes: alteração no intervalo marca a recomendação para reanálise; edição manual conserva a origem; cue sem tempo não é marcada automática; camadas não podem vazar entre tenants; remoção de palavra não modifica mídia original; ripple/sem-ripple e efeito sobre áudio são mostrados antes da confirmação; keyframes de posição preservam o estado anterior e a transição correta.

### 5. Render e exportação

Renderizar somente candidatos aprovados via FFmpeg para formato selecionado, mantendo original e versionando saída. Testes: falha parcial não registra arquivo pronto; download exige mesmo tenant; re-render preserva versões anteriores; cancelamento limpa somente temporários do job.

### 6. Reenquadramento e publicação

Adicionar reenquadramento/tracking e conectores de publicação somente após o fluxo de corte, legenda e exportação estar provado. Cada adaptador terá configuração por empresa, auditoria e testes próprios.

## Critérios de aceite do primeiro fluxo completo

1. Um vídeo de teste próprio percorre upload, transcrição temporizada, corte fundamentado, revisão, legenda e exportação.
2. A interface não mostra candidato, nota, transcrição, progresso ou arquivo fictício em qualquer erro/indisponibilidade.
3. O resultado exportado reproduz o intervalo aprovado e vincula-se ao ativo/empresa corretos.
4. Há testes de autorização, validação de mídia, falhas e persistência para cada etapa entregue.
5. Testes focados e a verificação completa definida pelo produto são executados sem ocultar falhas preexistentes.

## Decisões pendentes do usuário

- Conta de teste e momento para fazer o login manual na investigação autenticada.
- Dois ou três vídeos próprios de teste e o que considera um bom corte em cada um.
- Primeiro provedor real de transcrição/análise e como seus créditos serão configurados por empresa.
- A primeira exportação priorizará 9:16; 1:1 e 16:9 entram como versões posteriores do mesmo corte, quando o fluxo-base estiver comprovado.

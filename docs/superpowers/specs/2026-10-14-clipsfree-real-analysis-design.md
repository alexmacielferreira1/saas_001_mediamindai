# CLIPSFREE — análise real de cortes e legendas

## Intenção

Transformar o CLIPSFREE em uma jornada verificável para encontrar os melhores momentos de um arquivo de vídeo ou áudio enviado ao MediaMind. A prioridade definida por Alex é a seleção de trechos viralizáveis reais; legendas automáticas corretas são a segunda prioridade. O fluxo completo também deve permitir revisão, edição e saída em formatos de redes sociais.

## Evidência do estado atual

- `clipModel.js` ainda gera candidatos por intervalo fixo, `Math.random`, títulos fixos e notas sem relação com o arquivo.
- `ClipWorkspace.jsx` mostra uma transcrição e um resumo fixos no editor.
- `ClipLegendasPanel.jsx` cria uma legenda por corte usando título/resumo, em vez de segmentos transcritos com tempos reais.
- `ClipCandidatesPanel.jsx` já possui a interface de candidatos persistidos e chama a camada `clipEngineService`, porém ela ainda depende do cliente Base44 e de funções externas ausentes no runtime local.
- O ZIP de referência Supoclip usa a sequência correta: extrair áudio, transcrever com tempo, analisar o texto em janelas, validar limites de cada corte, pontuar, renderizar e gerar legendas palavra a palavra. Ele é licenciado em AGPL-3.0; nenhum código será copiado para o MediaMind.

## Resultado que o usuário verá

1. Ao enviar um arquivo, o CLIPSFREE cria um trabalho persistido ligado ao ativo real e mostra etapas reais: preparação de áudio, transcrição, análise, seleção e legendas.
2. Sem transcrição disponível, não há nota, corte nem texto inventados. A tela mostra erro acionável ou o estado “aguardando processamento”.
3. A análise cria candidatos somente com trechos contíguos da transcrição, com início/fim alinhados aos segmentos reais, duração configurável e texto-fonte exibido.
4. Cada candidato traz título editorial, quatro dimensões explicadas (gancho, fluxo, valor e compartilhamento), nota composta determinística e a citação do texto que sustenta a recomendação. A nota é uma ajuda editorial, não promessa de alcance.
5. O player busca o intervalo exato e permite ajustar IN/OUT. Depois do ajuste, a justificativa e a duração são recalculadas ou marcadas como “precisa reanalisar”.
6. Ao selecionar candidatos, as legendas são construídas a partir dos segmentos ou palavras da transcrição contidos no intervalo. O usuário pode corrigir texto, dividir, unir, ajustar tempo e estilo antes de exportar.
7. A exportação gera versão vertical/horizontal a partir dos intervalos aprovados, sem apagar o original. O resultado e os metadados ficam vinculados ao ativo, ao projeto e à empresa corretos.

## Arquitetura proposta

### Dados e processamento

- Introduzir endpoints nativos do backend MediaMind para iniciar, consultar e cancelar análise de um `MediaAsset` já autorizado à empresa atual.
- Persistir `TranscriptionSegment` e `ClipCandidate` tenant-scoped, com versão do analisador, fonte do texto, idioma, tempo de criação, motivo e scores detalhados.
- Extrair áudio com FFmpeg; usar provedor de transcrição configurado pela empresa ou Whisper local quando habilitado. Nenhuma chave de provedor sai pelo frontend.
- Rodar a seleção de candidatos como job em segundo plano. O analisador recebe apenas a transcrição do ativo e devolve JSON validado; os limites são corrigidos para as fronteiras de segmentos antes de persistir.
- Se a configuração de IA estiver ausente, oferecer somente revisão manual com player/IN/OUT e deixar claro que análise automática não foi executada.

### Pontuação editorial

Para cada candidato: gancho inicial, continuidade, densidade de valor e compartilhamento. O score composto é calculado no servidor a partir dessas quatro dimensões, com pesos publicados para a pessoa. O modelo não pode preencher um score sem texto-fonte, nem criar fala/tempo inexistente. Duração inicial: 15–60 segundos, preferindo 25–50 segundos; isso será configurável por perfil (Shorts/Reels/TikTok).

### Legendas

- A geração usa os segmentos/tempos persistidos da mesma transcrição escolhida pelo candidato.
- Legendas sem texto ou tempos válidos não podem ser salvas como “geradas automaticamente”.
- A UI preserva edição manual e sinaliza quando uma edição deixa de coincidir com a transcrição original.

### Interface

- Uma única tela CLIPSFREE: ativo e estado do job; player/transcrição; candidatos reais; editor de legenda; versões/exportação.
- Remover `DEMO_CANDIDATES`, indicadores/insights fixos e o gerador aleatório da rota ativa. Dados demonstrativos, se necessários, ficam somente em um modo demo explicitamente identificado e nunca após upload do usuário.
- Progresso e erros devem ser visíveis, com opção de reprocessar e sem travar a sessão.

## Fora de escopo deste bloco

- Garantia de views, integração de publicação automática e coleta de tendências em redes sociais.
- Copiar código, fontes, modelos ou assets do Supoclip.
- Controle de aplicativos Adobe/MCP, que é um fluxo separado.

## Segurança, recuperação e testes

- Autorizar todos os endpoints pelo tenant e pelo ativo; validar MIME, tamanho, caminho e duração antes de processar.
- Jobs idempotentes por ativo + versão de análise + perfil; cancelamento não apaga o original nem candidatos anteriores aprovados.
- Testes: arquivo sem áudio, falha de transcrição, ausência de IA, segmentação válida, limites de corte, score determinístico, isolamento por empresa, geração de legendas por intervalo e revisão/exportação de um candidato real.
- Critérios de aceite: nenhum `Math.random`, texto/título/nota fixa ou candidato demo no caminho de upload real; cada candidato aponta para transcrição real e pode ser reproduzido no player; legenda apresenta seus tempos reais.

## Decisões assumidas

- O MediaMind priorizará backend nativo e a configuração de IA já existente por empresa; integrações externas são adaptadores configuráveis, não dependência rígida.
- Como o usuário pediu o fluxo completo, o primeiro incremento entrega análise e legendas antes de efeitos visuais como reenquadramento facial, B-roll e publicação.

# Plano — MediaMind 100% local (servidor da emissora + intranet)

Data: 27/10/2026 · Base: `main` @ 5d36267 · Decisão do Alex: o alvo é o sistema rodando num servidor da emissora, aberto na intranet. O Render serve só para testes. No futuro, no máximo uma janela de Ingest remoto com login.

## Objetivo
Tudo funcionando no computador local, igual ao que vai para o servidor:
- Ingest a partir de uma **pasta de referência** (entrada);
- arquivos e resultados gravados numa **pasta de destino** (simula o armazenamento do servidor);
- **IAs locais**: Whisper para transcrição e Llama via Ollama para texto, roteiro e análise de cortes;
- **processamentos**: cortes, legendas, Copiloto, roteiro, thumbnails e remoção de fundo;
- nenhum serviço pago.

## Situação atual (levantamento no código)
| Área | Hoje | Falta |
|---|---|---|
| Armazenamento | Local em `MEDIA_ROOT` (padrão `.runtime/media`), configurável | Só configurar a pasta de destino. Fixar `AI_SECRET_KEY` antes, senão as conexões de IA cadastradas ficam ilegíveis |
| Pasta de referência | Não existe; só envio pelo navegador | Importar a pasta pelo servidor (código novo) |
| Ingest | O envio é real | A lista de pacotes é simulada (`MOCK_INGEST_PACKAGES`); o pacote não é salvo |
| ffmpeg | Procurado no PATH ou em `FFMPEG_PATH` | Instalar (exportações e duração das mídias dependem dele) |
| Llama (Ollama) | A conexão "compatível com OpenAI" já serve | Liberar endereço local (`OUTBOUND_ALLOW_PRIVATE_NETWORKS=true`, só em `local`) e cadastrar a conexão com chave fictícia |
| Whisper | Encaixe por comando externo (`CLIPS_TRANSCRIBER_COMMAND`) | Script-ponte Whisper → JSON; as variáveis precisam chegar ao processo da API |
| Análise de cortes | Comando externo (`CLIPS_ANALYSIS_COMMAND`) ou conexão remota | Script-ponte transcrição → Ollama → candidatos. Com conexão cadastrada, o sistema tenta `/audio/transcriptions`, que o Ollama não tem: separar "transcrição local" de "análise por conexão" |
| 6 telas de IA | Presas em `/ai/functions/*`, que sempre responde 503 | Ligar a rotas reais: Clip Engine, Roteiro, Transcrição do Workspace, Assistente IA, Prompt, Acessos |
| Geração de imagem | Padrão OpenAI `/images/generations` | O Ollama não gera imagem: precisa de servidor local compatível (Stable Diffusion/LocalAI) ou adaptador |
| Remoção de fundo | rembg local (já instalado) e MediaPipe no navegador | Baixar o modelo uma vez; deixar o provedor como `local` |
| OCR e detecção | Aparecem como "não configurado" | Sem backend: etapa futura |

## Etapas
1. **Ambiente local completo (configuração, sem mudar comportamento):**
   - `.env` local com `MEDIA_ROOT` (destino), `AI_SECRET_KEY`, `FFMPEG_PATH`, `ENVIRONMENT=local` e `OUTBOUND_ALLOW_PRIVATE_NETWORKS=true`;
   - carregar o `.env` também para as variáveis lidas direto do ambiente (`CLIPS_*`);
   - script `scripts/local-check.ps1` que confere ffmpeg, Ollama, Whisper, pastas e banco.
2. **Pasta de referência → Acervo (Ingest real):**
   - comando ou rota só-local que lê a pasta de entrada e grava cada mídia pelo mesmo caminho do upload (registro Asset + `save_original`), com relatório e sem duplicar arquivos já importados;
   - lista de pacotes real no lugar da simulada.
3. **Transcrição local (Whisper):**
   - script-ponte com faster-whisper (ou whisper.cpp) que produz o JSON `segments/words` que o sistema já entende;
   - ligado a Ingest, ClipsFree, legendas e Transcrição do Workspace.
4. **Llama local (Ollama):** *depende de assumir a configuração de IA, que hoje é do outro chat*
   - conexão local cadastrada e mapeada por ferramenta (Copiloto, Video Studio, roteiro, análise de cortes);
   - análise de cortes com transcrição local + análise pelo Llama;
   - as 6 telas presas em `/ai/functions` ligadas a rotas reais.
5. **Processamentos e exportação na pasta de destino:** exportar clipe/timeline do MMFilm e cortes do ClipsFree gravando no destino (hoje são apagados em 24 h); thumbnails e remoção de fundo locais.
6. **Intranet:** acesso pelo nome/IP do servidor na rede (CORS/CSRF para essas origens), instalação e atualização simples, backup local.
7. **Ingest remoto (futuro):** tela mínima com login e envio que retoma, sem expor o resto.

## O que instalar fora (no computador/servidor)
- **ffmpeg** (com ffprobe);
- **Ollama** e um modelo Llama (ex.: `llama3.1:8b`; para máquina mais fraca, um modelo menor);
- **Whisper**: faster-whisper (pacote Python) ou whisper.cpp, com modelo `small`/`medium` conforme a máquina;
- **Docker Desktop** (Postgres, já usado);
- opcional, para gerar imagens: Stable Diffusion com API compatível.

## Regras
- Configuração de IA e seus endpoints: só depois de assumir o trabalho do outro chat (o Alex vai colar o resumo de lá).
- Nada simulado: sem modelo instalado, a tela diz o que falta.
- Cada etapa com testes e conferência no navegador local.

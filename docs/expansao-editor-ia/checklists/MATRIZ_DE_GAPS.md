# Matriz de Gaps — atualizada em 2026-10-23 (PRs #6, #10 e #19)

Status: ✅ existe e funciona · 🟡 existe parcial · ❌ não existe
Base auditada: `origin/main` em 2d427b3 (inclui o MCP do MMFilm, commit 49f5677).
"MMFilm" = `frontend/src/mediamind/components/graphic-tools/FilmCraftWorkspace.jsx`; "painel" = grade de ícones do MCP no Copiloto
(`components/mcp/MCPToolPanel.jsx` + `lib/mcpActions.js` + `components/graphic-tools/mmfilmMcpTools.js`).

| # | Recurso | Módulo | Status | Onde está | O que falta |
|---|---|---|---|---|---|
| 1 | Shell com abas + busca + favoritos + idioma | M00 | 🟡 | `MCPToolPanel.jsx`: abas com ícone e descrição, busca, ★ favoritos, modo largo (tela cheia) | Idioma PT/EN |
| 2 | Barra "Última ação / Desfazer" | M00 | ✅ | `LastActionBar` + `recordLastAction` (painel e fila) | — |
| 3 | Rodapé: Transcrever / Importar SRT / Legendas + info da sequência + trilhas alvo | M00 | ✅ | `PanelFooter`: Transcrever (aba), Importar SRT, Legendas (aba), `Seq · 1920×1080 · fps · duração`, chips A3 SFX / V3 Legendas clicáveis | — |
| 4 | Modelo de timeline versionado + undo | M00 | ✅ | `commit()` + Desfazer + backups da sequência (10, automáticos antes de cada ferramenta e manuais, com restaurar) | Versões no servidor (a timeline segue no navegador) |
| 5 | Jobs com progresso real | M00 | 🟡 | Barra de progresso real na leitura do áudio e na detecção de cena | Jobs de backend (só serão necessários para transcrição) |
| 6 | Renderer/export da timeline editada | M00 | ✅ | Exportação WebM com movimento, motion presets, transições, looks, legendas com estilo, animação de texto e ducking (`programComposition`) | MP4 no servidor |
| 7 | Componente Waveform com regiões | M00/M01 | ✅ | `Waveform` (regiões de silêncio, linha do limite) | — |
| 8 | Silêncios: análise + parâmetros + waveform + aplicar | M01 | ✅ | Silêncios com seções, −/+ com `?`, forma de onda, recálculo ao ajustar, confirmação | — |
| 9 | Silêncios: preservar música e trilhas travadas + backup | M01 | ✅ | Música e trilhas travadas preservadas + Backup automático | — |
| 10 | Cortes: pausas / SRT / cena + lista com checkbox + clipe mínimo | M02 | ✅ | Detectar cortes: pausas (margens 80/80), fim de frase (legendas/SRT), mudança de cena (comparação de quadros), lista com checkbox | — |
| 11 | Auto Ducking (dB, ataque, retorno, detecção de trilhas) | M03 | ✅ | Ducking com detecção automática voz/música, chips −6…−18 dB, % do tempo com voz | — |
| 12 | Normalizar (alvo, pico −1 dB) | M03 | ✅ | Normalizar (alvo, pico) | — |
| 13 | Sincronizar por forma de onda + confiança + cadeia | M04 | ✅ | `mmfilmSync.js` + `sync.waveform`: offset < 2 ms, confiança, referência, cadeia, desligar áudio das câmeras | — |
| 14 | Multicâmera (até 4 + geral, ritmo, variar) | M05 | ✅ | `mmfilmMulticam.js` + `multicam.cut`: até 4 pessoas + geral, ritmo, variar, planos fora do ar desativados | — |
| 15 | Transcrição com timestamps por palavra + progresso | M06 | ✅ | `transcribe.run` pelo serviço de transcrição do Acervo/ClipsFree (reaproveita a salva) + Importar SRT | Arquivos do computador seguem com Importar SRT |
| 16 | Importar SRT | M06 | ✅ | Rodapé e aba Transcrição | — |
| 17 | Vícios de linguagem (hesitações, repetições) | M06 | ✅ | `fillers.remove` (hesitações, repetições, pausas reais quando há áudio) | Tempo exato por palavra depende da transcrição |
| 18 | Legendas: formatos (palavra/linhas) | M06 | ✅ | `captions.create`: palavra por palavra ou até 6 linhas, caracteres, MAIÚSCULAS, sem pontuação | Medir largura em pixels |
| 19 | Legendas: biblioteca de templates com pastas/busca/prévia | M06 | ✅ | 12 templates próprios em pastas | Pré-visualização em miniatura na grade |
| 20 | Legendas: troca de fonte + aviso fonte ausente + controles do template | M06 | ✅ | Fonte, cor, tamanho, alinhamento, caixa + aviso de fonte ausente | — |
| 21 | Legendas: "da timeline" / nativa / re-transcrever | M06 | ✅ | Re-transcrever, estilo da timeline, exportar SRT | — |
| 22 | Títulos animados (frases de impacto) | M06 | ✅ | `titles.create` com animação | — |
| 23 | SFX biblioteca (categorias, prévia, favoritos, pastas próprias) | M07 | ✅ | `sfx.library`: categorias pelo nome do arquivo, prévia ▶, inserir no indicador; favoritos do painel | Pacotes próprios de sons livres (CC0) |
| 24 | SFX automático (cortes, texto, palavras fortes, espaço mínimo, rotação) | M07 | ✅ | Cortes, textos, palavras fortes, espaço mínimo, alternância | — |
| 25 | Animação de texto (presets + prévia hover) | M08 | ✅ | 27 animações próprias (Entrada, Digitação, Ênfase, Saída) no preview e no export | Prévia ao passar o mouse |
| 26 | Motion presets entrada/saída | M08 | ✅ | 28 motion presets em 10 categorias, entrada/saída/ambos | Prévia em vídeo |
| 27 | Movimentos rápidos com intensidade 1–10 | M08 | ✅ | Zoom suave, punch in, shake, pan, rotação, motion blur, escala, centralizar, rampa de velocidade | — |
| 28 | Clonar estilo | M08 | ✅ | `motion.clonestyle` | — |
| 29 | Auto Zoom | M08 | ✅ | `motion.autozoom` | — |
| 30 | Packs: transições, LUTs, looks, títulos, créditos, multi-tela + prévias | M09 | ✅ | 16 transições, 17 looks, multi-tela (5 layouts), título de abertura e créditos | Prévias em vídeo |
| 31 | Auto Edit com 10 etapas + confirmação + desfazer único | M10 | ✅ | Auto Edit com as 10 etapas + SFX, idioma, títulos, estilo, confirmação, backup e desfazer único | — |

## Observações da auditoria
- **Botões sem handler / mocks:** na ferramenta nova, nenhum. No MMFilm antigo: "Transcrever" avisa indisponível (honesto); efeitos/transições de vídeo do workspace "Efeitos" só registram o nome (não renderizam); "Predefinições Lumetri" só listam.
- **Dependências:** FFmpeg (backend, `find_ffmpeg`), transcrição por comando local ou API configurada (`app/clips/transcription.py`). Não há scipy, pyscenedetect, pyloudnorm nem libass no backend. No navegador: Web Audio, canvas, MediaRecorder.
- **Fila de jobs:** não há fila genérica com progresso; filas MCP (`TenantRecord` "MCPQueue") sem percentual.
- **Diferenças do plano em relação ao código real:** backend é SQLAlchemy **síncrono** com `pip` (não Poetry/async); a timeline do MMFilm vive no navegador (rascunho local), não no banco; os arquivos do computador não são enviados ao servidor.
- **Riscos:** (1) análise no servidor exigiria upload das mídias locais; (2) transcrição toca a configuração de IA de outro chat; (3) prints são material de marketing de terceiros — usados só como referência de UX, fora do Git; (4) MMEffects (After) está com outra sessão (branch `feat/mcp-icones-apps-graficos`, sem commit).

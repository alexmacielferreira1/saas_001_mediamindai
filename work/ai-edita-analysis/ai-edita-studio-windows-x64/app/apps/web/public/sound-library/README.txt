AI Edita - biblioteca de efeitos sonoros

Todos os arquivos desta pasta sao originais, sintetizados pelo proprio AI Edita com
osciladores, ruido filtrado e reverbs (scripts/sound-library/generate.py). Nao ha
gravacoes de terceiros, nem amostras compradas ou baixadas: nenhuma atribuicao e
necessaria.

Uso
  Livre nos seus videos, inclusive comerciais e patrocinados, sem creditar ninguem.
  Nao redistribua a biblioteca separada do aplicativo.

Formato
  WAV PCM 48 kHz, 16 bits, estereo. Cada efeito termina em silencio e tem pico
  maximo de -1 dBFS.

Calibragem por categoria (RMS medio)
  impacto -17 dB   transicao -20 dB   salto -20 dB   glitch -21 dB
  whoosh -21 dB    destaque -22 dB    interface -23 dB
  riser -24 dB     ambiencia -32 dB
  Os graves ficam no impacto e o movimento acima de 4 kHz, deixando a faixa da voz
  (1,5 a 4 kHz) livre para a narracao.

catalog.json descreve as categorias e cada efeito (nome, tags, duracao, forma de
onda). O painel Sons e a Hanna leem esse arquivo; regenere-o sempre que mudar os
efeitos:

  python scripts/sound-library/generate.py

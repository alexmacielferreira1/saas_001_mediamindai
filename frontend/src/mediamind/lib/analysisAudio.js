// Áudio só para ANÁLISE (Silêncios, Cortes, Ducking, Normalizar, Sincronizar…), lido em pedaços.
// O caminho normal (filmcraftAudio.loadAudioBuffer) baixa o arquivo inteiro e usa decodeAudioData, que
// recusa arquivos acima de 150 MB e alguns codecs. Aqui o mediabunny lê o contêiner por requisições
// parciais (Range) e decodifica aos poucos; o resultado é mono e com taxa reduzida, suficiente para
// medir volume e alinhar formas de onda, sem ocupar a memória do arquivo original.
// A reprodução continua no motor de áudio do editor: nada aqui toca som.
// Ideia inspirada na leitura em pedaços do AI Edita; mediabunny é MPL-2.0 (THIRD_PARTY_NOTICES.md).

export const ANALYSIS_SAMPLE_RATE = 8000;
// 4 h a 8 kHz em mono ≈ 460 MB de Float32: acima disso a análise no navegador fica inviável.
export const MAX_ANALYSIS_SECONDS = 4 * 60 * 60;

const cache = new Map();
const failures = new Map();

async function defaultOpen(url) {
  const { ALL_FORMATS, AudioBufferSink, Input, UrlSource } = await import("mediabunny");
  const input = new Input({ source: new UrlSource(url, { requestInit: { credentials: "include" } }), formats: ALL_FORMATS });
  return {
    async audio() {
      const track = await input.getPrimaryAudioTrack();
      if (!track) return null;
      return { duration: await track.computeDuration(), buffers: () => new AudioBufferSink(track).buffers(0) };
    },
    dispose: () => input.dispose?.(),
  };
}

/**
 * Mistura os canais e reduz a taxa somando cada amostra no "balde" de saída do instante dela (média por
 * balde). É um passa-baixas simples: preserva a energia que as análises medem, não serve para ouvir.
 */
export function createDownmixer(totalSeconds, rate = ANALYSIS_SAMPLE_RATE) {
  const length = Math.max(1, Math.ceil(totalSeconds * rate) + 1);
  const sums = new Float32Array(length);
  const counts = new Uint16Array(length);
  let filled = 0;
  return {
    add(buffer, timestamp = 0) {
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
      for (let index = 0; index < buffer.length; index += 1) {
        const slot = Math.floor((timestamp + index / buffer.sampleRate) * rate);
        if (slot < 0 || slot >= length) continue;
        let value = 0;
        for (const data of channels) value += data[index];
        sums[slot] += value / channels.length;
        counts[slot] = Math.min(65535, counts[slot] + 1);
        if (slot + 1 > filled) filled = slot + 1;
      }
    },
    finish() {
      const data = new Float32Array(filled);
      for (let index = 0; index < filled; index += 1) data[index] = counts[index] ? sums[index] / counts[index] : 0;
      return { sampleRate: rate, length: filled, numberOfChannels: 1, duration: filled / rate, getChannelData: () => data, analysisOnly: true };
    },
  };
}

// O mediabunny avisa resposta HTTP ruim só na mensagem ("Error fetching <url>: 404 Not Found"); separa
// esse caso para o editor dizer "arquivo não encontrado" em vez de "não foi possível decodificar".
function describeFailure(error) {
  const message = error?.message || "falha ao ler o áudio em pedaços";
  const http = /^Error fetching .*: (\d{3})\b/.exec(message);
  if (http) return { kind: "http", status: Number(http[1]), message };
  return { kind: error?.kind || "decode", message };
}

/**
 * Lê o áudio de `url` em pedaços e devolve um buffer de análise (mono, ANALYSIS_SAMPLE_RATE) ou null.
 * O motivo da falha fica em `analysisAudioFailure(url)`. Sucesso fica em cache por URL.
 */
export function loadAnalysisAudio(url, { open = defaultOpen, onProgress } = {}) {
  if (cache.has(url)) return cache.get(url);
  const pending = (async () => {
    const media = await open(url);
    try {
      const audio = await media.audio();
      if (!audio) throw Object.assign(new Error("a mídia não tem faixa de áudio"), { kind: "no-audio" });
      if (!(audio.duration > 0)) throw Object.assign(new Error("duração do áudio desconhecida"), { kind: "decode" });
      if (audio.duration > MAX_ANALYSIS_SECONDS)
        throw Object.assign(new Error("áudio longo demais para analisar no navegador (mais de 4 h)"), { kind: "too-long" });
      const mixer = createDownmixer(audio.duration);
      for await (const { buffer, timestamp } of audio.buffers()) {
        mixer.add(buffer, timestamp);
        onProgress?.(Math.min(1, (timestamp + buffer.duration) / audio.duration));
      }
      const result = mixer.finish();
      if (result.length <= 1) throw Object.assign(new Error("nenhuma amostra de áudio decodificada"), { kind: "decode" });
      return result;
    } finally {
      await media.dispose?.();
    }
  })().then(
    (buffer) => {
      failures.delete(url);
      return buffer;
    },
    (error) => {
      failures.set(url, describeFailure(error));
      if (cache.get(url) === pending) cache.delete(url);
      return null;
    },
  );
  cache.set(url, pending);
  return pending;
}

/** Motivo da última falha da leitura em pedaços: { kind: "http" (com status) | "no-audio" | "too-long" | "decode", message }. */
export const analysisAudioFailure = (url) => failures.get(url);

export function clearAnalysisAudioCache() {
  cache.clear();
  failures.clear();
}

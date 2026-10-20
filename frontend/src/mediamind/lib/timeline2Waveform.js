// Adaptado de OpenCut (MIT) — ver THIRD_PARTY_NOTICES.md (media/waveform-summary.ts):
// peaks are the maximum absolute sample of each bucket, across all channels.

const PEAKS_PER_SECOND = 50;
const MAX_PEAKS = 30000;
const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;

/** Peak amplitude (0..1) per bucket for the given channel sample arrays. */
export function computeWaveformPeaks(channels, bucketCount) {
  const length = Math.max(0, ...channels.map((data) => data.length));
  const count = Math.max(1, Math.floor(bucketCount) || 1);
  const bucketSize = Math.max(1, Math.ceil(length / count));
  const peaks = new Float32Array(count);
  for (let bucket = 0; bucket < count; bucket += 1) {
    const from = bucket * bucketSize;
    const to = Math.min(length, from + bucketSize);
    let peak = 0;
    for (let channel = 0; channel < channels.length; channel += 1) {
      const data = channels[channel];
      for (let index = from; index < to; index += 1) {
        const value = Math.abs(data[index] || 0);
        if (value > peak) peak = value;
      }
    }
    peaks[bucket] = Math.min(1, peak);
  }
  return peaks;
}

/** Peaks for a source window [sourceStart, sourceEnd) reduced to `bars` values. */
export function sliceWaveform(summary, sourceStart, sourceEnd, bars) {
  const count = Math.max(0, Math.floor(bars));
  if (!summary?.peaks?.length || !count || !(summary.duration > 0)) return [];
  const perSecond = summary.peaks.length / summary.duration;
  const from = Math.max(0, Number(sourceStart) || 0);
  const to = Math.max(from, Number(sourceEnd) || 0);
  return Array.from({ length: count }, (_, bar) => {
    const startIndex = Math.floor((from + ((to - from) * bar) / count) * perSecond);
    const endIndex = Math.max(startIndex + 1, Math.floor((from + ((to - from) * (bar + 1)) / count) * perSecond));
    let peak = 0;
    for (let index = startIndex; index < endIndex && index < summary.peaks.length; index += 1) peak = Math.max(peak, summary.peaks[index]);
    return peak;
  });
}

export function isWaveformSupported() {
  return typeof window !== 'undefined' && typeof (window.AudioContext || window.webkitAudioContext) === 'function' && typeof fetch === 'function';
}

const cache = new Map();

/** Downloads and decodes the audio once per source URL; resolves to { duration, peaks } or rejects. */
export function loadWaveform(src) {
  if (!src) return Promise.reject(new Error('Sem fonte de áudio.'));
  if (!isWaveformSupported()) return Promise.reject(new Error('Navegador sem Web Audio.'));
  if (cache.has(src)) return cache.get(src);
  const promise = (async () => {
    const response = await fetch(src, { credentials: 'include' });
    if (!response.ok) throw new Error(`Falha ao carregar áudio (${response.status}).`);
    const declared = Number(response.headers?.get?.('content-length')) || 0;
    if (declared > MAX_DOWNLOAD_BYTES) throw new Error('Arquivo grande demais para desenhar a forma de onda.');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_DOWNLOAD_BYTES) throw new Error('Arquivo grande demais para desenhar a forma de onda.');
    const Context = window.AudioContext || window.webkitAudioContext;
    const context = new Context();
    try {
      const buffer = await context.decodeAudioData(bytes);
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
      const count = Math.min(MAX_PEAKS, Math.max(1, Math.ceil(buffer.duration * PEAKS_PER_SECOND)));
      return { duration: buffer.duration, peaks: computeWaveformPeaks(channels, count) };
    } finally {
      context.close?.().catch?.(() => {});
    }
  })();
  cache.set(src, promise);
  return promise;
}

export function clearWaveformCache() {
  cache.clear();
}

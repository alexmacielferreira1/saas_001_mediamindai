// Forma de onda do áudio do vídeo de origem, decodificada no navegador.
// Adaptado de OpenCut (MIT) — ver THIRD_PARTY_NOTICES.md (media/waveform-summary.ts).
import { computePeaks } from './clipEditorTools';

// Decodifica em taxa baixa para limitar memória; duração máxima protege sessões longas.
export const WAVEFORM_SAMPLE_RATE = 8000;
export const WAVEFORM_MAX_DURATION_MS = 30 * 60 * 1000;
export const WAVEFORM_MAX_BYTES = 1024 * 1024 * 1024;

export class WaveformError extends Error {
  constructor(message) { super(message); this.name = 'WaveformError'; }
}

export function waveformSupport(win = typeof window === 'undefined' ? undefined : window) {
  const Offline = win?.OfflineAudioContext || win?.webkitOfflineAudioContext;
  return typeof Offline === 'function' ? Offline : null;
}

// Só lê vídeos carregados deste computador (blob:), sem novo download do servidor.
export async function decodeWaveform(url, { durationMs = 0, buckets = 1200, win = typeof window === 'undefined' ? undefined : window } = {}) {
  const Offline = waveformSupport(win);
  if (!Offline) throw new WaveformError('Forma de onda indisponível neste navegador.');
  if (!/^blob:/i.test(String(url || ''))) throw new WaveformError('A forma de onda está disponível só para vídeos carregados deste computador.');
  if (durationMs > WAVEFORM_MAX_DURATION_MS) throw new WaveformError('Vídeo longo demais para gerar a forma de onda no navegador (máx. 30 min).');
  const response = await win.fetch(url);
  const blob = await response.blob();
  if (blob.size > WAVEFORM_MAX_BYTES) throw new WaveformError('Arquivo grande demais para gerar a forma de onda no navegador.');
  const data = await blob.arrayBuffer();
  const context = new Offline(1, 1, WAVEFORM_SAMPLE_RATE);
  let buffer;
  try {
    buffer = await context.decodeAudioData(data);
  } catch {
    throw new WaveformError('Não foi possível decodificar o áudio deste vídeo.');
  }
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  return { peaks: computePeaks(channels, buckets), durationMs: buffer.duration * 1000 };
}

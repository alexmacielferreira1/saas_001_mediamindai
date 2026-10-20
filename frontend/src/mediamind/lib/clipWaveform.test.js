import { describe, expect, it, vi } from 'vitest';
import { decodeWaveform, waveformSupport } from './clipWaveform';

function fakeWindow({ decode, size = 10 } = {}) {
  class Offline {
    decodeAudioData(data) { return decode ? decode(data) : Promise.resolve({ numberOfChannels: 1, duration: 2, getChannelData: () => new Float32Array([0, 0.4, 0.8, 0.2]) }); }
  }
  const blob = { size, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) };
  return { OfflineAudioContext: Offline, fetch: vi.fn(() => Promise.resolve({ blob: () => Promise.resolve(blob) })) };
}

describe('clipWaveform', () => {
  it('reports missing Web Audio support honestly (jsdom)', async () => {
    expect(waveformSupport({})).toBeNull();
    await expect(decodeWaveform('blob:x', { win: {} })).rejects.toThrow('Forma de onda indisponível neste navegador.');
  });

  it('only reads local blob sources and refuses long sessions', async () => {
    const win = fakeWindow();
    await expect(decodeWaveform('/api/v1/media/1', { win })).rejects.toThrow('vídeos carregados deste computador');
    await expect(decodeWaveform('blob:x', { win, durationMs: 31 * 60 * 1000 })).rejects.toThrow('máx. 30 min');
    expect(win.fetch).not.toHaveBeenCalled();
  });

  it('decodes peaks from the local file', async () => {
    const result = await decodeWaveform('blob:x', { win: fakeWindow(), buckets: 2 });
    expect(result.durationMs).toBe(2000);
    expect(result.peaks[0]).toBeCloseTo(0.4);
    expect(result.peaks[1]).toBeCloseTo(0.8);
  });

  it('rejects oversized files and undecodable audio', async () => {
    await expect(decodeWaveform('blob:x', { win: fakeWindow({ size: 2 * 1024 * 1024 * 1024 }) })).rejects.toThrow('grande demais');
    await expect(decodeWaveform('blob:x', { win: fakeWindow({ decode: () => Promise.reject(new Error('x')) }) })).rejects.toThrow('Não foi possível decodificar');
  });
});

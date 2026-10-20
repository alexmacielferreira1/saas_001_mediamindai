import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearWaveformCache, computeWaveformPeaks, isWaveformSupported, loadWaveform, sliceWaveform } from './timeline2Waveform';

describe('timeline waveform', () => {
  afterEach(() => {
    clearWaveformCache();
    vi.unstubAllGlobals();
    delete window.AudioContext;
  });

  it('computes the peak of each bucket across channels', () => {
    const left = Float32Array.from([0.1, -0.8, 0.2, 0.05]);
    const right = Float32Array.from([0.3, 0.1, -0.4, 0.9]);
    expect(Array.from(computeWaveformPeaks([left, right], 2)).map((value) => Number(value.toFixed(2)))).toEqual([0.8, 0.9]);
  });

  it('slices the clip source window into bars', () => {
    const summary = { duration: 4, peaks: Float32Array.from([0.1, 0.2, 0.9, 0.3, 0.4, 0.5, 0.6, 1]) };
    expect(sliceWaveform(summary, 1, 3, 2).map((value) => Number(value.toFixed(2)))).toEqual([0.9, 0.5]);
    expect(sliceWaveform(null, 0, 1, 4)).toEqual([]);
  });

  it('rejects without Web Audio instead of drawing a fake waveform', async () => {
    expect(isWaveformSupported()).toBe(false);
    await expect(loadWaveform('/audio.mp3')).rejects.toThrow(/Web Audio/);
  });

  it('decodes the real file once per source and closes the audio context', async () => {
    const close = vi.fn(() => Promise.resolve());
    const decodeAudioData = vi.fn(async () => ({ duration: 1, numberOfChannels: 1, getChannelData: () => Float32Array.from([0.5, -1]) }));
    window.AudioContext = vi.fn(function AudioContextMock() { this.decodeAudioData = decodeAudioData; this.close = close; });
    const fetchMock = vi.fn(async () => ({ ok: true, headers: { get: () => '4' }, arrayBuffer: async () => new ArrayBuffer(4) }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await loadWaveform('/api/v1/media/assets/a/stream');
    await loadWaveform('/api/v1/media/assets/a/stream');
    expect(first.duration).toBe(1);
    expect(first.peaks.length).toBe(50);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/media/assets/a/stream', { credentials: 'include' });
    expect(close).toHaveBeenCalled();
  });

  it('refuses files that are too large and failed downloads', async () => {
    window.AudioContext = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async (src) => (src === '/big' ? { ok: true, headers: { get: () => String(500 * 1024 * 1024) }, arrayBuffer: async () => new ArrayBuffer(1) } : { ok: false, status: 404 })));
    await expect(loadWaveform('/big')).rejects.toThrow(/grande/);
    await expect(loadWaveform('/missing')).rejects.toThrow(/404/);
  });
});

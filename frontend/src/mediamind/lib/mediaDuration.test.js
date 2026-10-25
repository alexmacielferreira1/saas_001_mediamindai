import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const update = vi.fn();
vi.mock('@/api/base44Client', () => ({ base44: { entities: { Asset: { update: (...a) => update(...a) } } } }));

import { ensureAssetDurations, measureFileDuration, persistAssetDuration, probeMediaDuration, uploadWithDuration, withMeasuredDuration } from './mediaDuration';

describe('duração medida no navegador (B5)', () => {
  beforeEach(() => { update.mockReset().mockResolvedValue({}); localStorage.removeItem('mm_demo_session_v1'); });
  afterEach(() => vi.restoreAllMocks());

  it('lê a duração do elemento de mídia em loadedmetadata', async () => {
    const original = document.createElement.bind(document);
    let created;
    vi.spyOn(document, 'createElement').mockImplementation((tag) => { created = original(tag); return created; });
    const pending = probeMediaDuration('/video.webm', 'video');
    Object.defineProperty(created, 'duration', { value: 3.04, configurable: true });
    created.dispatchEvent(new Event('loadedmetadata'));
    await expect(pending).resolves.toBe(3.04);
    expect(created.tagName).toBe('VIDEO');
  });

  it('devolve null em erro ou duração inválida', async () => {
    const original = document.createElement.bind(document);
    let created;
    vi.spyOn(document, 'createElement').mockImplementation((tag) => { created = original(tag); return created; });
    const failing = probeMediaDuration('/quebrado.mp3', 'audio');
    created.dispatchEvent(new Event('error'));
    await expect(failing).resolves.toBeNull();
    const zero = probeMediaDuration('/vazio.mp4', 'video');
    Object.defineProperty(created, 'duration', { value: 0, configurable: true });
    created.dispatchEvent(new Event('loadedmetadata'));
    await expect(zero).resolves.toBeNull();
    await expect(probeMediaDuration('', 'video')).resolves.toBeNull();
  });

  it('WebM do MediaRecorder (duração Infinity): força o cálculo indo ao fim do arquivo', async () => {
    const original = document.createElement.bind(document);
    let created;
    vi.spyOn(document, 'createElement').mockImplementation((tag) => { created = original(tag); return created; });
    const pending = probeMediaDuration('/gravado.webm', 'video');
    let duration = Infinity;
    Object.defineProperty(created, 'duration', { get: () => duration, configurable: true });
    created.dispatchEvent(new Event('loadedmetadata'));
    expect(created.currentTime).toBeGreaterThan(1e100);
    duration = 3.021;
    created.dispatchEvent(new Event('durationchange'));
    await expect(pending).resolves.toBe(3.021);
  });

  it('desiste após o tempo limite', async () => {
    vi.useFakeTimers();
    const pending = probeMediaDuration('/lento.mp4', 'video', { timeoutMs: 50 });
    vi.advanceTimersByTime(60);
    await expect(pending).resolves.toBeNull();
    vi.useRealTimers();
  });

  it('mede só vídeo/áudio sem duração e grava no Asset', async () => {
    const probe = vi.fn().mockResolvedValue(3);
    const persist = vi.fn().mockResolvedValue(true);
    const assets = [
      { id: 'a1', asset_type: 'video', stream_url: '/a1' },
      { id: 'a2', asset_type: 'video', stream_url: '/a2', duration: 12 },
      { id: 'a3', asset_type: 'image', stream_url: '/a3' },
      { id: 'a4', asset_type: 'audio' },
    ];
    const result = await ensureAssetDurations(assets, { probe, persist });
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith('/a1', 'video');
    expect(persist).toHaveBeenCalledWith(assets[0], 3);
    expect(result[0]).toEqual(expect.objectContaining({ id: 'a1', duration: 3 }));
    expect(result.slice(1)).toEqual(assets.slice(1));
  });

  it('mantém o asset quando não consegue medir', async () => {
    const assets = [{ id: 'a1', asset_type: 'video', stream_url: '/a1' }];
    const persist = vi.fn();
    expect(await ensureAssetDurations(assets, { probe: vi.fn().mockResolvedValue(null), persist })).toEqual(assets);
    expect(persist).not.toHaveBeenCalled();
  });

  it('grava a duração pelo cliente de records; falha não quebra; demo não grava', async () => {
    await expect(persistAssetDuration({ id: 'a1' }, 3)).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith('a1', { duration: 3, duration_source: 'browser' });
    update.mockRejectedValueOnce(new Error('403'));
    await expect(persistAssetDuration({ id: 'a1' }, 3)).resolves.toBe(false);
    localStorage.setItem('mm_demo_session_v1', JSON.stringify({ id: 'demo' }));
    update.mockClear();
    await expect(persistAssetDuration({ id: 'a1' }, 3)).resolves.toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('mede o arquivo local por URL temporária e libera a URL', async () => {
    const create = vi.fn(() => 'blob:local');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe');
    const probe = vi.fn().mockResolvedValue(2.5);
    const file = new File(['v'], 'a.webm', { type: 'video/webm' });
    await expect(measureFileDuration(file, { probe })).resolves.toBe(2.5);
    expect(probe).toHaveBeenCalledWith('blob:local', 'video');
    expect(revoke).toHaveBeenCalledWith('blob:local');
    vi.unstubAllGlobals();
  });

  it('não tenta medir formato que o navegador não decodifica nem arquivo que não é mídia', async () => {
    const probe = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');
    URL.createObjectURL ??= () => 'blob:x';
    await expect(measureFileDuration(new File(['v'], 'a.mkv', { type: 'video/x-matroska' }), { probe })).resolves.toBeNull();
    await expect(measureFileDuration(new File(['d'], 'a.pdf', { type: 'application/pdf' }), { probe })).resolves.toBeNull();
    expect(probe).not.toHaveBeenCalled();
  });

  it('completa a duração do Asset recém-enviado só quando o servidor não mediu', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    await expect(withMeasuredDuration({ id: 'a', duration: 7 }, 3, { persist })).resolves.toEqual({ id: 'a', duration: 7 });
    await expect(withMeasuredDuration({ id: 'a' }, null, { persist })).resolves.toEqual({ id: 'a' });
    await expect(withMeasuredDuration({ id: 'a' }, 3, { persist })).resolves.toEqual(expect.objectContaining({ id: 'a', duration: 3 }));
    expect(persist).toHaveBeenCalledTimes(1);
    const upload = vi.fn().mockResolvedValue({ id: 'u', duration: 4 });
    await expect(uploadWithDuration(new File(['d'], 'a.pdf', { type: 'application/pdf' }), upload)).resolves.toEqual({ id: 'u', duration: 4 });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { filter, transcribe } = vi.hoisted(() => ({ filter: vi.fn(), transcribe: vi.fn() }));
vi.mock('@/api/base44Client', () => ({ base44: { entities: { TranscricaoSegmento: { filter: (...args) => filter(...args) } } } }));
vi.mock('../../api/media', () => ({ transcribeMediaAsset: (...args) => transcribe(...args) }));

import { ensureTranscription } from './clipEngineService';

describe('ensureTranscription', () => {
  beforeEach(() => { filter.mockReset(); transcribe.mockReset(); localStorage.clear(); });

  it('reaproveita trechos já gravados sem chamar o servidor', async () => {
    filter.mockResolvedValue([{ id: 's1' }]);
    await expect(ensureTranscription({ id: 7 })).resolves.toEqual({ segments: [{ id: 's1' }], reused: true });
    expect(filter).toHaveBeenCalledWith({ asset_id: '7' }, 'start_ms', 500);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('transcreve no servidor (Whisper local) e lê os trechos gravados', async () => {
    filter.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 's1' }, { id: 's2' }]);
    transcribe.mockResolvedValue({ segments: 2 });
    await expect(ensureTranscription({ id: 'a', media_asset_id: 'm' })).resolves.toEqual({ segments: [{ id: 's1' }, { id: 's2' }], reused: false });
    expect(transcribe).toHaveBeenCalledWith('m');
  });

  it('no modo demonstração explica que precisa do servidor', async () => {
    localStorage.setItem('mm_demo_session_v1', JSON.stringify({ id: 'demo' }));
    filter.mockResolvedValue([]);
    await expect(ensureTranscription({ id: 'a' })).rejects.toThrow(/modo demonstração não transcreve/);
    expect(transcribe).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { filter, transcribe } = vi.hoisted(() => ({ filter: vi.fn(), transcribe: vi.fn() }));
vi.mock('@/api/base44Client', () => ({ base44: { entities: { TranscricaoSegmento: { filter: (...args) => filter(...args) } } } }));
vi.mock('../../api/media', () => ({ transcribeMediaAsset: (...args) => transcribe(...args) }));
const { startAnalysis } = vi.hoisted(() => ({ startAnalysis: vi.fn() }));
vi.mock('../../api/clips', () => ({ startClipAnalysis: (...args) => startAnalysis(...args) }));

import { ensureTranscription, runAnalysis } from './clipEngineService';

describe('runAnalysis (análise de cortes real)', () => {
  beforeEach(() => startAnalysis.mockReset());

  it('converte a faixa de duração e envia o pedido editorial para /clips/analyses', async () => {
    startAnalysis.mockResolvedValue({ status: 'completed', candidates: [{ id: 'c1' }] });
    await expect(runAnalysis({ asset: { id: 'a', media_asset_id: 'm' }, prompt: 'momentos fortes', purpose: 'social', durationLabel: '<30s' }))
      .resolves.toEqual([{ id: 'c1' }]);
    expect(startAnalysis).toHaveBeenCalledWith('m', null, { minimum: 15, maximum: 30, editorial_prompt: 'momentos fortes\nFinalidade: social' });
    startAnalysis.mockResolvedValue({ status: 'completed' });
    await expect(runAnalysis({ asset: { id: 'a' }, durationLabel: 'desconhecida' })).resolves.toEqual([]);
    expect(startAnalysis).toHaveBeenLastCalledWith('a', null, { minimum: 15, maximum: 60, editorial_prompt: '' });
  });

  it('falha com o motivo do servidor quando a análise não termina', async () => {
    startAnalysis.mockResolvedValueOnce({ status: 'unavailable', message: 'Nenhuma fala reconhecida.' }).mockResolvedValueOnce(null);
    await expect(runAnalysis({ asset: { id: 'a' } })).rejects.toThrow('Nenhuma fala reconhecida.');
    await expect(runAnalysis({ asset: { id: 'a' } })).rejects.toThrow('A análise não terminou.');
  });
});

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

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Timeline2 from './Timeline2';
import { addMediaClip, createTimeline2Document, separateClipAudio } from '../lib/timeline2Model';

const mediaApi = vi.hoisted(() => ({
  listMediaAssets: vi.fn(),
  uploadMediaAsset: vi.fn(),
  exportMediaClip: vi.fn(),
  exportTimeline: vi.fn(),
}));
const durationApi = vi.hoisted(() => ({ ensureAssetDurations: vi.fn() }));

vi.mock('../../api/media', () => ({ ...mediaApi, mediaStreamUrl: (asset) => asset.stream_url }));
vi.mock('../lib/mediaDuration', () => durationApi);

const KEY = 'mm_timeline2_project:linked-project';
const saved = () => JSON.parse(localStorage.getItem(KEY));
const clipOf = (document, id) => document.tracks.flatMap((track) => track.clips).find((clip) => clip.id === id);

function renderLinkedDraft() {
  const base = addMediaClip(createTimeline2Document({ id: 'linked-project' }), { id: 'asset-v', clipId: 'video-1', name: 'Entrevista', kind: 'video', duration: 6, src: '/v.mp4' }, { trackId: 'v1', start: 0 });
  localStorage.setItem('mm_workspace2_timeline2_draft', JSON.stringify(separateClipAudio(base, 'video-1')));
  return render(<Timeline2 />);
}

describe('Timeline 2 — correções da revisão (B4, B5, A3)', () => {
  beforeEach(() => {
    localStorage.clear();
    mediaApi.listMediaAssets.mockReset().mockResolvedValue([]);
    durationApi.ensureAssetDurations.mockReset().mockImplementation(async (items) => items);
  });
  afterEach(() => vi.restoreAllMocks());

  it('B4: arrastar o vídeo leva junto o áudio vinculado', () => {
    renderLinkedDraft();
    const canvas = screen.getByTestId('timeline2-track-v1').querySelector('[data-track-canvas]');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 1000, right: 1000, top: 0, bottom: 48, height: 48, x: 0, y: 0, toJSON: () => ({}) });
    const clip = within(canvas).getByRole('button');
    fireEvent.pointerDown(clip, { clientX: 10, clientY: 24, pointerId: 3, buttons: 1 });
    fireEvent.pointerMove(clip, { clientX: 210, clientY: 24, pointerId: 3, buttons: 1 });
    fireEvent.pointerUp(clip, { clientX: 210, clientY: 24, pointerId: 3 });

    const document = saved();
    const video = clipOf(document, 'video-1');
    const audio = clipOf(document, 'video-1-audio');
    expect(video.start).toBeGreaterThan(0);
    expect(audio.start).toBeCloseTo(video.start, 6);
  });

  it('B4: mudar a posição pelo inspetor também move o áudio vinculado', () => {
    renderLinkedDraft();
    const canvas = screen.getByTestId('timeline2-track-v1').querySelector('[data-track-canvas]');
    fireEvent.click(within(canvas).getByRole('button'));
    fireEvent.change(screen.getByLabelText('Posição do clipe'), { target: { value: '4' } });
    expect(clipOf(saved(), 'video-1-audio').start).toBeCloseTo(4, 6);
  });

  it('A3: "Salvar projeto" grava na chave que o editor lê e mostra a hora', () => {
    renderLinkedDraft();
    localStorage.removeItem(KEY);
    fireEvent.click(screen.getByRole('button', { name: /Salvar projeto/ }));
    expect(saved()).toEqual(expect.objectContaining({ id: 'linked-project' }));
    expect(localStorage.getItem('mm_timeline2_project')).toBeNull();
    expect(screen.getByText(/^Salvo neste navegador às \d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('A3: cota cheia mostra erro em vez de silêncio', () => {
    renderLinkedDraft();
    const quota = Object.assign(new Error('exceeded the quota'), { name: 'QuotaExceededError' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw quota; });
    fireEvent.click(screen.getByRole('button', { name: /Salvar projeto/ }));
    expect(screen.getByText(/o espaço deste navegador está cheio/)).toBeInTheDocument();
  });

  it('B5: usa a duração medida no navegador quando o servidor não mediu', async () => {
    mediaApi.listMediaAssets.mockResolvedValue([{ id: 'no-probe', filename: 'curto.webm', title: 'Clipe curto', asset_type: 'video', stream_url: '/curto.webm' }]);
    durationApi.ensureAssetDurations.mockImplementation(async (items) => items.map((asset) => ({ ...asset, duration: 3 })));
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    await waitFor(() => expect(durationApi.ensureAssetDurations).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Clipe curto' }));
    const document = JSON.parse(localStorage.getItem('mm_timeline2_project:timeline2-local'));
    const clip = document.tracks.flatMap((track) => track.clips).find((item) => item.assetId === 'no-probe');
    expect(clip.duration).toBe(3);
  });
});

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Timeline2 from './Timeline2';
import { addMediaClip, createTimeline2Document } from '../lib/timeline2Model';

const mediaApi = vi.hoisted(() => ({
  listMediaAssets: vi.fn(),
  uploadMediaAsset: vi.fn(),
  exportMediaClip: vi.fn(),
  exportTimeline: vi.fn(),
}));

vi.mock('../../api/media', () => ({
  ...mediaApi,
  mediaStreamUrl: (asset) => asset.stream_url,
}));

const realAsset = {
  id: 'asset-regression',
  filename: 'entrevista.mp4',
  title: 'Entrevista real',
  asset_type: 'video',
  duration: 20,
  stream_url: '/api/v1/media/assets/asset-regression/stream',
  media_status: 'ready',
};

describe('Timeline 2 pointer regressions', () => {
  beforeEach(() => {
    localStorage.clear();
    mediaApi.listMediaAssets.mockReset().mockResolvedValue([realAsset]);
  });

  // Regression: ISSUE-002 — a clip drag stored a live DOM node that became invalid after rerender.
  // Found by /qa on 2026-09-27.
  // Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-09-27.md
  it('moves a clip using immutable ruler bounds throughout the gesture', async () => {
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Entrevista real' }));

    const canvas = screen.getByTestId('timeline2-track-v1').querySelector('[data-track-canvas]');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 100, width: 1000, right: 1100, top: 0, bottom: 48, height: 48, x: 100, y: 0, toJSON: () => ({}),
    });
    const clip = within(canvas).getByRole('button');
    clip.setPointerCapture = () => { throw new DOMException('Pointer is no longer active', 'NotFoundError'); };

    fireEvent.pointerDown(clip, { clientX: 100, clientY: 24, pointerId: 2, buttons: 1 });
    canvas.getBoundingClientRect = null;
    fireEvent.pointerMove(clip, { clientX: 200, clientY: 24, pointerId: 2, buttons: 1 });
    fireEvent.pointerUp(clip, { clientX: 200, clientY: 24, pointerId: 2 });

    expect(screen.getByLabelText('Posição do clipe')).toHaveValue(3);
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeEnabled();
  });

  it('creates an inspector keyframe and changes its interpolation curve', async () => {
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Entrevista real' }));
    const canvas = screen.getByTestId('timeline2-track-v1').querySelector('[data-track-canvas]');
    fireEvent.click(within(canvas).getByRole('button'));

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar keyframe Escala' }));
    expect(screen.getByRole('button', { name: 'Remover keyframe Escala' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Curva do keyframe Escala'), { target: { value: 'bezier' } });
    const saved = JSON.parse(localStorage.getItem('mm_timeline2_project:timeline2-local'));
    expect(saved.tracks[0].clips[0].keyframes.scale[0]).toMatchObject({ value: 100, easing: 'bezier' });
  });

  it('navigates by frame and to sequence boundaries with professional shortcuts', async () => {
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Entrevista real' }));
    const playhead = screen.getByLabelText('Playhead');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(Number(playhead.value)).toBeCloseTo(1 / 30, 4);
    fireEvent.keyDown(window, { key: 'End' });
    expect(playhead).toHaveValue('20');
    fireEvent.keyDown(window, { key: 'Home' });
    expect(playhead).toHaveValue('0');
  });

  it('adds and removes real empty tracks from the editor toolbar', () => {
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar trilha de vídeo' }));
    expect(screen.getByTestId('timeline2-track-v3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover Vídeo 3' }));
    expect(screen.queryByTestId('timeline2-track-v3')).not.toBeInTheDocument();
  });

  it('separates the original audio of an imported video into the audio track', async () => {
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Entrevista real' }));
    fireEvent.click(screen.getByRole('button', { name: /Separar áudio original/i }));

    const audioTrack = screen.getByTestId('timeline2-track-a1').querySelector('[data-track-canvas]');
    expect(within(audioTrack).getByRole('button')).toHaveTextContent(/Entrevista real · áudio/i);
    expect(screen.getByRole('button', { name: /Áudio já separado/i })).toBeDisabled();
  });

  it('marks sequence IN and OUT with buttons and I/O shortcuts', async () => {
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Entrevista real' }));
    const playhead = screen.getByLabelText('Playhead');

    fireEvent.change(playhead, { target: { value: '2' } });
    fireEvent.keyDown(window, { key: 'i' });
    expect(screen.getByTestId('timeline-in-point')).toHaveTextContent('00:00:02:00');
    fireEvent.change(playhead, { target: { value: '8' } });
    fireEvent.keyDown(window, { key: 'o' });
    expect(screen.getByTestId('timeline-out-point')).toHaveTextContent('00:00:08:00');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar IN e OUT' }));
    expect(screen.getByTestId('timeline-in-point')).toHaveTextContent('—');
  });

  it('drags the vertical playhead handle without moving the clip underneath it', async () => {
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Entrevista real' }));
    const ruler = screen.getByRole('slider', { name: 'Régua e agulha da timeline' });
    vi.spyOn(ruler, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 900 });
    const needle = screen.getByRole('slider', { name: 'Arrastar agulha vertical' });
    needle.setPointerCapture = () => { throw new DOMException('Pointer is no longer active', 'NotFoundError'); };

    fireEvent.pointerDown(needle, { clientX: 100, pointerId: 9, buttons: 1 });
    fireEvent.pointerMove(needle, { clientX: 400, pointerId: 9, buttons: 1 });
    fireEvent.pointerUp(needle, { clientX: 400, pointerId: 9 });

    expect(screen.getByLabelText('Playhead')).toHaveValue('10');
    expect(screen.getByLabelText('Posição do clipe')).toHaveValue(0);
  });

  it('continues the Timeline preview clock through an empty black gap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T12:00:00Z'));
    const draft = addMediaClip(createTimeline2Document({ id: 'gap-project' }), {
      id: 'gap-asset', clipId: 'gap-clip', name: 'Depois da lacuna', kind: 'video', duration: 4, src: '/after-gap.mp4',
    }, { trackId: 'v1', start: 2 });
    localStorage.setItem('mm_workspace2_timeline2_draft', JSON.stringify(draft));
    render(<Timeline2 />);

    expect(screen.getByText('Quadro preto · sequência em andamento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproduzir' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir' }));
    act(() => vi.advanceTimersByTime(1500));
    expect(Number(screen.getByLabelText('Playhead').value)).toBeGreaterThanOrEqual(1.4);
    vi.useRealTimers();
  });
});

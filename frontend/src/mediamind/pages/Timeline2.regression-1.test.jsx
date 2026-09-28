import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Timeline2 from './Timeline2';

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
});

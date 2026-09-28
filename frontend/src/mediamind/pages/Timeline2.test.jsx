import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  id: 'asset-1', filename: 'entrevista.mp4', title: 'Entrevista real', asset_type: 'video',
  duration: 20, stream_url: '/api/v1/media/assets/asset-1/stream', media_status: 'ready',
};

describe('Timeline 2', () => {
  beforeEach(() => {
    localStorage.clear();
    mediaApi.listMediaAssets.mockReset().mockResolvedValue([realAsset]);
    mediaApi.uploadMediaAsset.mockReset();
  });

  it('performs split and undo on the real project document', async () => {
    render(<Timeline2 />);

    expect(screen.getByRole('heading', { name: 'Timeline 2' })).toBeInTheDocument();
    const track = screen.getByTestId('timeline2-track-v1');
    const canvas = track.querySelector('[data-track-canvas]');
    expect(within(canvas).queryAllByRole('button')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Entrevista real' }));

    fireEvent.click(within(canvas).getAllByRole('button')[0]);
    fireEvent.change(screen.getByLabelText('Playhead'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dividir clipe' }));
    expect(within(canvas).getAllByRole('button')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(within(canvas).getAllByRole('button')).toHaveLength(1);
  });

  it('changes zoom and snapping as editor state', () => {
    render(<Timeline2 />);
    fireEvent.change(screen.getByLabelText('Zoom da Timeline 2'), { target: { value: '2' } });
    expect(screen.getByText('200%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desativar snapping' }));
    expect(screen.getByRole('button', { name: 'Ativar snapping' })).toBeInTheDocument();
  });

  it('adds an asset from the MediaMind archive to the real timeline document', async () => {
    render(<Timeline2 />);
    const track = screen.getByTestId('timeline2-track-v1');
    const canvas = track.querySelector('[data-track-canvas]');
    expect(within(canvas).queryAllByRole('button')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Entrevista real' }));

    expect(within(canvas).getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent(/adicionado à timeline/i);
  });

  it('uploads a selected file to the backend and uses its persistent stream', async () => {
    const uploaded = { ...realAsset, id: 'asset-2', title: 'Novo vídeo', filename: 'novo.mp4', stream_url: '/api/v1/media/assets/asset-2/stream' };
    mediaApi.uploadMediaAsset.mockResolvedValue(uploaded);
    render(<Timeline2 />);
    const file = new File(['video'], 'novo.mp4', { type: 'video/mp4' });

    fireEvent.change(screen.getByLabelText('Importar vídeos e áudios'), { target: { files: [file] } });

    await waitFor(() => expect(mediaApi.uploadMediaAsset).toHaveBeenCalledWith(file));
    expect((await screen.findAllByText('Novo vídeo')).length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toHaveTextContent(/ao acervo/i);
  });

  it('positions the playhead by clicking the ruler and the track canvas', async () => {
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Entrevista real' }));

    const ruler = screen.getByRole('slider', { name: 'Régua e agulha da timeline' });
    vi.spyOn(ruler, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 900 });
    fireEvent.pointerDown(ruler, { clientX: 550, pointerId: 1 });
    expect(screen.getByLabelText('Playhead')).toHaveValue('15');

    const canvas = screen.getByTestId('timeline2-track-v1').querySelector('[data-track-canvas]');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 900 });
    fireEvent.pointerDown(canvas, { clientX: 400, pointerId: 2 });
    expect(screen.getByLabelText('Playhead')).toHaveValue('10');
  });

  it('drops archive media at the pointer time instead of the old playhead', async () => {
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    const add = await screen.findByRole('button', { name: 'Adicionar Entrevista real' });
    const media = add.closest('[draggable="true"]');
    const canvas = screen.getByTestId('timeline2-track-v1').querySelector('[data-track-canvas]');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 900 });

    const drop = createEvent.drop(canvas, {
      dataTransfer: {
        getData: (type) => type === 'application/x-timeline2-media'
          ? JSON.stringify({ id: realAsset.id, name: realAsset.title, kind: 'video', duration: 20, src: realAsset.stream_url })
          : '',
      },
    });
    Object.defineProperty(drop, 'clientX', { value: 550 });
    fireEvent(canvas, drop);

    expect(media).toBeInTheDocument();
    expect(screen.getByLabelText('Posição do clipe')).toHaveValue(15);
  });

  it('moves an existing clip horizontally with a pointer drag', async () => {
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Entrevista real' }));

    const canvas = screen.getByTestId('timeline2-track-v1').querySelector('[data-track-canvas]');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 900 });
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => canvas) });
    const clip = canvas.querySelector('button[title^="Arraste"]');

    fireEvent.pointerDown(clip, { clientX: 100, clientY: 10, button: 0, buttons: 1, pointerId: 3 });
    fireEvent.pointerMove(clip, { clientX: 400, clientY: 10, button: 0, buttons: 1, pointerId: 3 });
    fireEvent.pointerUp(clip, { clientX: 400, clientY: 10, button: 0, pointerId: 3 });

    expect(screen.getByLabelText('Posição do clipe')).toHaveValue(10);
  });
});

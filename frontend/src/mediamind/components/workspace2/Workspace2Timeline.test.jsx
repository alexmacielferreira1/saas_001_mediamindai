import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Workspace2Timeline from './Workspace2Timeline';

const assets = [
  { id: 1, title: 'Entrevista Prefeito', duration: 90, icon: '🎙️' },
  { id: 7, title: 'B-roll - Cidade ao amanhecer', duration: 78, icon: '🏙️' },
];

describe('Workspace 2 timeline step', () => {
  it('selects a project asset and renders the editing tracks', () => {
    const onPreview = vi.fn();
    render(<Workspace2Timeline selectedAssets={assets} previewAsset={assets[1]} blocks={[{ id: 'b1', title: assets[0].title, duration: 90, type: 'media' }]} onPreview={onPreview} />);

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar Entrevista Prefeito' }));
    expect(onPreview).toHaveBeenCalledWith(assets[0]);
    expect(screen.getByText('V3')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
  });

  it('applies clip controls and exposes visible operation feedback', () => {
    const onAddAsset = vi.fn();
    render(<Workspace2Timeline selectedAssets={assets} previewAsset={assets[1]} onAddAsset={onAddAsset} />);
    fireEvent.change(screen.getByLabelText('Opacidade'), { target: { value: '72' } });
    expect(screen.getByText('72%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cortar' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Corte marcado/i);

    const transfer = { setData: vi.fn(), getData: vi.fn(() => '1') };
    fireEvent.dragStart(screen.getByRole('button', { name: 'Selecionar Entrevista Prefeito' }), { dataTransfer: transfer });
    fireEvent.drop(screen.getByText('GC – Cidade que avança · solte uma mídia aqui').closest('.flex.h-11'), { dataTransfer: transfer });
    expect(onAddAsset).toHaveBeenCalledWith(assets[0]);
  });

  it('controls real media playback, IN/OUT points and markers', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const media = { ...assets[0], asset_type: 'video', stream_url: '/media/interview.mp4' };
    render(<Workspace2Timeline selectedAssets={[media]} previewAsset={media} compact />);

    const video = screen.getByTestId('workspace2-preview-media');
    Object.defineProperty(video, 'duration', { configurable: true, value: 90 });
    fireEvent.loadedMetadata(video);
    video.currentTime = 12;
    fireEvent.timeUpdate(video);
    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir mídia' }));
    expect(play).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Pausar mídia' }));
    expect(pause).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Marcar IN' }));
    expect(screen.getByTestId('workspace2-in-point')).toHaveTextContent('00:12');
    video.currentTime = 31;
    fireEvent.timeUpdate(video);
    fireEvent.click(screen.getByRole('button', { name: 'Marcar OUT' }));
    expect(screen.getByTestId('workspace2-out-point')).toHaveTextContent('00:31');
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar marcador' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Marcador adicionado em 00:31/i);

    play.mockRestore();
    pause.mockRestore();
  });
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ClipStageResources from './ClipStageResources';
import ClipPlayer from './ClipPlayer';
import ClipCGPanel from './ClipCGPanel';

const media = vi.hoisted(() => ({ uploadMediaAsset: vi.fn(), listMediaAssets: vi.fn(), resolveMediaUrl: (url) => url }));
vi.mock('../../../../api/media', () => media);

describe('biblioteca de assets dos cortes', () => {
  it('adds the editable reference GC as an independent timed layer', () => {
    media.listMediaAssets.mockResolvedValue([]);
    const onChange = vi.fn();
    render(<ClipStageResources stage="selecao" clip={{ cgs: [], in_ms: 1000 }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar GC barra animada/i }));
    expect(onChange).toHaveBeenCalledWith({ cgs: [expect.objectContaining({ template: 'barra-editorial', start_ms: 1000, titulo: 'Título principal', subtitulo: 'Texto complementar' })] });
  });

  it('uploads an asset and makes it available in the library', async () => {
    media.listMediaAssets.mockResolvedValue([]);
    media.uploadMediaAsset.mockResolvedValue({ id: 'asset-1', title: 'Logo novo', asset_type: 'image', stream_url: '/logo.png', origin: 'clipsfree-assets' });
    render(<ClipStageResources stage="selecao" clip={{ cgs: [], in_ms: 0 }} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Adicionar arquivos aos assets'), { target: { files: [new File(['a'], 'logo.png', { type: 'image/png' })] } });
    expect(await screen.findByText('Logo novo')).toBeInTheDocument();
  });

  it('adds an uploaded image to the clip as a timed visual layer', async () => {
    media.listMediaAssets.mockResolvedValue([{ id: 'logo-1', title: 'Marca', asset_type: 'image', stream_url: '/marca.png', origin: 'clipsfree-assets' }]);
    const onChange = vi.fn();
    render(<ClipStageResources stage="selecao" clip={{ cgs: [], in_ms: 2000 }} onChange={onChange} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar imagem Marca ao corte' }));
    expect(onChange).toHaveBeenCalledWith({ cgs: [expect.objectContaining({ tipo: 'imagem', asset_id: 'logo-1', source_url: '/marca.png', start_ms: 2000 })] });
  });

  it('shows an image layer during its selected interval', () => {
    render(<ClipPlayer overlays={[{ id: 'logo', tipo: 'imagem', titulo: 'Marca', source_url: '/marca.png', start_ms: 0, end_ms: 5000 }]} />);
    expect(screen.getByRole('img', { name: 'Marca' })).toHaveAttribute('src', '/marca.png');
  });

  it('renders the custom colors and both lines in the timed preview', () => {
    render(<ClipPlayer overlays={[{ id: 'gc', template: 'barra-editorial', titulo: 'NOME', subtitulo: 'CARGO', cor_barra: '#ff0000', cor_painel: '#ffffff', cor_texto: '#000000', start_ms: 0, end_ms: 5000 }]} />);
    expect(screen.getByLabelText('GC barra editorial em prévia')).toHaveTextContent('NOME');
    expect(screen.getByLabelText('GC barra editorial em prévia')).toHaveTextContent('CARGO');
  });

  it('reveals and closes the GC according to the clip playback position', () => {
    const { container } = render(<ClipPlayer source_url="/video.mp4" overlays={[{ id: 'gc', template: 'barra-editorial', titulo: 'NOME', subtitulo: 'CARGO', start_ms: 1000, end_ms: 5000 }]} />);
    const video = container.querySelector('video');
    video.currentTime = 2;
    fireEvent.timeUpdate(video);
    const graphic = screen.getByLabelText('GC barra editorial em prévia');
    expect(graphic.style.clipPath).toBe('inset(0 0% 0 0)');
    video.currentTime = 4.8;
    fireEvent.timeUpdate(video);
    expect(graphic.style.clipPath).not.toBe('inset(0 0% 0 0)');
  });

  it('edits the second line and colors of an added GC', () => {
    const onChange = vi.fn();
    render(<ClipCGPanel clip={{ id: 'one', in_ms: 0, cgs: [{ id: 'gc', template: 'barra-editorial', tipo: 'lower_third', titulo: 'Nome', subtitulo: 'Cargo', cor_barra: '#ffcc00', cor_painel: '#ffffff', cor_texto: '#000000', start_ms: 0, end_ms: 4000 }] }} onChange={onChange} seekTo={vi.fn()} onAvancar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Segunda linha do GC Nome'), { target: { value: 'Médica' } });
    expect(onChange).toHaveBeenCalledWith({ cgs: [expect.objectContaining({ subtitulo: 'Médica' })] });
    fireEvent.change(screen.getByLabelText('Cor da barra Nome'), { target: { value: '#ff0000' } });
    expect(onChange).toHaveBeenCalledWith({ cgs: [expect.objectContaining({ cor_barra: '#ff0000' })] });
  });
});

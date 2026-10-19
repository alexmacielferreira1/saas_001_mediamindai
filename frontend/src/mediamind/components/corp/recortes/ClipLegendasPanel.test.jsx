import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ClipLegendasPanel from './ClipLegendasPanel';

const clip = {
  id: 'clip-caption-test',
  in_ms: 0,
  out_ms: 9000,
  legendas: [{ id: 'caption-1', start_ms: 1000, end_ms: 4000, texto: 'Texto da legenda', cortar_audio: false }],
  cortes_audio: [],
};

describe('ClipLegendasPanel', () => {
  it('persists the chosen caption style and position instead of making the controls decorative', () => {
    const onChange = vi.fn();
    render(<ClipLegendasPanel clip={clip} onChange={onChange} seekTo={vi.fn()} onSalvar={vi.fn()} onAvancar={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dinâmico' }));
    expect(onChange).toHaveBeenLastCalledWith({ legendas: [expect.objectContaining({ id: 'caption-1', estilo: 'dinamico' })] });

    fireEvent.click(screen.getByRole('button', { name: 'Topo' }));
    expect(onChange).toHaveBeenLastCalledWith({ legendas: [expect.objectContaining({ id: 'caption-1', posicao: 'top' })] });
  });

  it('distinguishes removing only a caption from removing its caption and video interval', () => {
    const onChange = vi.fn();
    render(<ClipLegendasPanel clip={clip} onChange={onChange} seekTo={vi.fn()} onSalvar={vi.fn()} onAvancar={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remover legenda e vídeo' }));

    expect(onChange).toHaveBeenLastCalledWith({
      legendas: [],
      cortes_audio: [],
      cortes_video: [{ start_ms: 1000, end_ms: 4000 }],
    });
  });

  it('applies a caption position to subsequent captions without changing earlier ones', () => {
    const captions = [
      { id: 'a', start_ms: 0, end_ms: 1000, texto: 'Antes', posicao: 'bottom' },
      { id: 'b', start_ms: 1000, end_ms: 2000, texto: 'Atual', posicao: 'top' },
      { id: 'c', start_ms: 2000, end_ms: 3000, texto: 'Depois', posicao: 'bottom' },
    ];
    const onChange = vi.fn();
    render(<ClipLegendasPanel clip={{ ...clip, legendas: captions }} onChange={onChange} seekTo={vi.fn()} onSalvar={vi.fn()} onAvancar={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Aplicar posição daqui em diante' })[1]);
    expect(onChange).toHaveBeenLastCalledWith({ legendas: [captions[0], captions[1], { ...captions[2], posicao: 'top' }] });
  });

  it('updates the timing of a caption without changing its text', () => {
    const onChange = vi.fn();
    render(<ClipLegendasPanel clip={clip} onChange={onChange} seekTo={vi.fn()} onSalvar={vi.fn()} onAvancar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Início da legenda em milissegundos'), { target: { value: '1200' } });
    expect(onChange).toHaveBeenLastCalledWith({ legendas: [{ ...clip.legendas[0], start_ms: 1200 }] });
  });
});

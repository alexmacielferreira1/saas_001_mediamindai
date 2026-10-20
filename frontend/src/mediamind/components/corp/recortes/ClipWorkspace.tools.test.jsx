import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const player = vi.hoisted(() => ({ props: null }));
vi.mock('./ClipPlayer', () => ({ default: (props) => { player.props = props; return null; } }));
vi.mock('./ClipCandidatesPanel', () => ({ default: () => null }));
vi.mock('./ClipCGPanel', () => ({ default: () => null }));
vi.mock('./ClipReimportPanel', () => ({ default: () => null }));
vi.mock('./ClipStageResources', () => ({ default: () => null }));
import ClipWorkspace from './ClipWorkspace';

const clip = (extra = {}) => ({ id: 'w', stage: 'selecao', in_ms: 10000, out_ms: 20000, duration_ms: 40000, viral: [], cgs: [], legendas: [], cortes_audio: [], cortes_video: [], ...extra });

describe('ferramentas de corte do editor', () => {
  it('changes the clip aspect and reframing focus and forwards them to the preview', () => {
    const onChange = vi.fn();
    render(<ClipWorkspace clip={clip({ formato: '16:9', legenda_estilo: 'neon' })} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '9:16' }));
    expect(onChange).toHaveBeenCalledWith({ formato: '9:16' });
    fireEvent.change(screen.getByLabelText('Foco horizontal do reenquadramento'), { target: { value: '30' } });
    expect(onChange).toHaveBeenCalledWith({ foco_x: 0.3 });
    expect(player.props).toMatchObject({ format: '16:9', captionTemplate: 'neon' });
  });

  it('sets OUT from duration presets without passing the source duration', () => {
    const onChange = vi.fn();
    render(<ClipWorkspace clip={clip({ in_ms: 20000 })} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '15s' }));
    expect(onChange).toHaveBeenCalledWith({ out_ms: 35000 });
    fireEvent.click(screen.getByRole('button', { name: '30s' }));
    expect(onChange).toHaveBeenCalledWith({ out_ms: 40000 });
  });

  it('warns when OUT is not after IN', () => {
    render(<ClipWorkspace clip={clip({ in_ms: 5000, out_ms: 3000 })} onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('O OUT precisa ser posterior ao IN.');
  });
});

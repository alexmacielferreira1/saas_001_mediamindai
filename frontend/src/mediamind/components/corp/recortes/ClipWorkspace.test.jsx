import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./ClipPlayer',()=>({default:()=>null}));
vi.mock('./ClipCandidatesPanel',()=>({default:()=>null}));
vi.mock('./ClipCGPanel',()=>({default:()=>null}));
vi.mock('./ClipReimportPanel',()=>({default:()=>null}));
import ClipWorkspace from './ClipWorkspace';

const clip = (id,stage) => ({ id, stage, in_ms:0, out_ms:1000, viral:[], cgs:[], legendas:[], cortes_audio:[], cortes_video:[] });

describe('ClipWorkspace selection',()=>{
  it('resets the visible workflow stage when another clip is selected',()=>{
    const { rerender } = render(<ClipWorkspace clip={clip('old','legendas')} onChange={vi.fn()}/>);
    expect(screen.getByRole('button',{name:/Edição externa/})).toHaveClass('bg-sky-500');
    rerender(<ClipWorkspace clip={clip('new','selecao')} onChange={vi.fn()}/>);
    expect(screen.getByRole('button',{name:/Edição do corte/})).toHaveClass('bg-sky-500');
  });

  it('adds a real editable text layer from the editor toolbar without leaving the workflow',()=>{
    const onChange = vi.fn();
    render(<ClipWorkspace clip={clip('toolbar','selecao')} onChange={onChange}/>);

    fireEvent.click(screen.getByRole('button',{name:'Adicionar texto'}));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      cgs: [expect.objectContaining({ tipo: 'titulo', titulo: 'Novo texto' })],
    }));
    expect(screen.getByRole('button',{name:/Edição do corte/})).toHaveClass('bg-sky-500');
  });

  it('provides the caption editor next to the analysis without switching tabs',()=>{
    const onChange = vi.fn();
    render(<ClipWorkspace clip={clip('captions','ia')} onChange={onChange}/>);
    fireEvent.click(screen.getByRole('button',{name:'Legenda'}));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({legendas:[expect.objectContaining({texto:''})]}));
    expect(screen.queryByText(/A pontuação e a justificativa dependem/)).not.toBeInTheDocument();
  });
});

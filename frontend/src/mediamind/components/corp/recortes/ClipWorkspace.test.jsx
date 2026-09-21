import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./ClipPlayer',()=>({default:()=>null}));
vi.mock('./ClipCandidatesPanel',()=>({default:()=>null}));
vi.mock('./ClipLegendasPanel',()=>({default:()=>null}));
vi.mock('./ClipCGPanel',()=>({default:()=>null}));
vi.mock('./ClipReimportPanel',()=>({default:()=>null}));
import ClipWorkspace from './ClipWorkspace';

const clip = (id,stage) => ({ id, stage, in_ms:0, out_ms:1000, viral:[], cgs:[] });

describe('ClipWorkspace selection',()=>{
  it('resets the visible workflow stage when another clip is selected',()=>{
    const { rerender } = render(<ClipWorkspace clip={clip('old','legendas')} onChange={vi.fn()}/>);
    expect(screen.getByRole('button',{name:/Legendas/})).toHaveClass('bg-sky-500');
    rerender(<ClipWorkspace clip={clip('new','selecao')} onChange={vi.fn()}/>);
    expect(screen.getByRole('button',{name:/Seleção/})).toHaveClass('bg-sky-500');
  });
});

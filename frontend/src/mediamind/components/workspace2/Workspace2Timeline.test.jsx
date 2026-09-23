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
});

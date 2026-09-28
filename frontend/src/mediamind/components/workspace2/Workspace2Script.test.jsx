import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Workspace2Script from './Workspace2Script';

const asset = { id: 7, title: 'B-roll - Cidade ao amanhecer', duration: 78, icon: '🏙️' };

describe('Workspace 2 script step', () => {
  it('adds a selected asset, removes a block and advances to timeline', () => {
    const onAddAsset = vi.fn();
    const onRemoveBlock = vi.fn();
    const onStepChange = vi.fn();
    const onAddText = vi.fn();
    render(<Workspace2Script selectedAssets={[asset]} blocks={[{ id: 'b1', assetId: 7, title: asset.title, type: 'media', duration: 78 }]} onAddAsset={onAddAsset} onAddText={onAddText} onRemoveBlock={onRemoveBlock} onStepChange={onStepChange} />);

    fireEvent.click(screen.getByRole('button', { name: `Adicionar ${asset.title}` }));
    expect(onAddAsset).toHaveBeenCalledWith(asset);

    fireEvent.click(screen.getByRole('button', { name: `Remover bloco ${asset.title}` }));
    expect(onRemoveBlock).toHaveBeenCalledWith('b1');

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar texto' }));
    expect(onAddText).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Ir para Timeline' }));
    expect(onStepChange).toHaveBeenCalledWith('timeline');
  });

  it('selects any script in the list and filters the quick media search', () => {
    const onProjectChange = vi.fn();
    render(<Workspace2Script selectedAssets={[asset, { id: 8, title: 'Entrevista coletiva', duration: 30, icon: '🎤' }]} onProjectChange={onProjectChange} />);

    const scripts = screen.getAllByRole('button', { name: /Abrir roteiro/i });
    fireEvent.click(scripts[1]);
    expect(scripts[1]).toHaveAttribute('aria-pressed', 'true');
    expect(onProjectChange).toHaveBeenCalledWith('title', expect.any(String));

    fireEvent.change(screen.getByLabelText('Pesquisa rápida de mídias'), { target: { value: 'entrevista' } });
    expect(screen.queryByText(asset.title)).not.toBeInTheDocument();
    expect(screen.getByText('Entrevista coletiva')).toBeInTheDocument();
  });
});

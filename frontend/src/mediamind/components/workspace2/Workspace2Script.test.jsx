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

    fireEvent.click(screen.getByRole('button', { name: `Adicionar ${asset.title} ao roteiro` }));
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

  it('keeps the page-one media search on the left and the script list on the right', () => {
    const interview = { id: 8, title: 'Entrevista coletiva', filename: 'coletiva.mov', asset_type: 'video', duration: 30, icon: '🎤' };
    const onAddAsset = vi.fn();
    const onToggle = vi.fn();
    render(
      <Workspace2Script
        assets={[asset, interview]}
        selectedAssets={[asset]}
        onAddAsset={onAddAsset}
        onToggle={onToggle}
        mediaSearch={{
          filters: { filename: 'entrevista', transcription: '', person: '', gc: '', local: '', date: '' },
          quickType: 'all',
        }}
      />,
    );

    const layout = screen.getByTestId('workspace2-script');
    const media = screen.getByRole('complementary', { name: 'Mídias do Acervo' });
    const scripts = screen.getByRole('complementary', { name: 'Lista de roteiros' });
    expect(layout.firstElementChild).toBe(media);
    expect(layout.lastElementChild).toBe(scripts);
    expect(screen.getByLabelText('Data da mídia do roteiro')).toBeInTheDocument();
    expect(screen.getByText('Entrevista coletiva')).toBeInTheDocument();
    expect(screen.queryByText(asset.title)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Entrevista coletiva ao roteiro' }));
    expect(onToggle).toHaveBeenCalledWith(8);
    expect(onAddAsset).toHaveBeenCalledWith(interview);
  });
});

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

    fireEvent.click(screen.getByRole('button', { name: 'Roteiros' }));
    const scripts = screen.getAllByRole('button').filter((button) => button.textContent.includes('Jornal'));
    fireEvent.click(scripts[1]);
    expect(onProjectChange).toHaveBeenCalledWith('title', expect.any(String));

    fireEvent.click(screen.getByRole('button', { name: 'Acervo' }));
    fireEvent.change(screen.getByLabelText('Pesquisa rápida de mídias'), { target: { value: 'entrevista' } });
    expect(screen.queryByText(asset.title)).not.toBeInTheDocument();
    expect(screen.getAllByText('Entrevista coletiva').length).toBeGreaterThan(0);
  });

  it('keeps the page-one media search in the library and the editable script on the right', () => {
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
    const media = screen.getByRole('complementary', { name: 'Biblioteca do roteiro' });
    const scripts = screen.getByRole('complementary', { name: 'Roteiro editável' });
    expect(layout).toContainElement(media);
    expect(layout).toContainElement(scripts);
    expect(screen.getByRole('region', { name: 'Preview da mídia' })).toBeInTheDocument();
    expect(screen.getAllByText('Entrevista coletiva').length).toBeGreaterThan(0);
    expect(screen.queryByText(asset.title)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Entrevista coletiva ao roteiro' }));
    expect(onToggle).toHaveBeenCalledWith(8);
    expect(onAddAsset).toHaveBeenCalledWith(interview);
  });

  it('offers the preserved script templates inside the workspace', () => {
    const onProjectChange = vi.fn();
    const onNotice = vi.fn();
    render(<Workspace2Script project={{ template: '' }} onProjectChange={onProjectChange} onNotice={onNotice} />);

    fireEvent.click(screen.getByRole('button', { name: 'Modelos' }));
    expect(screen.getByRole('button', { name: /Reportagem Usar modelo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrevista Usar modelo/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cabeça \+ off \+ sonora Usar modelo/i }));

    expect(onProjectChange).toHaveBeenCalledWith('template', 'Cabeça + off + sonora');
    expect(onNotice).toHaveBeenCalledWith('Modelo de roteiro “Cabeça + off + sonora” aplicado');
  });

  it('drags a script card above another card to change the order', () => {
    const onReorderBlocks = vi.fn();
    const blocks = [
      { id: 'b1', title: 'Primeiro', type: 'media', duration: 10 },
      { id: 'b2', title: 'Segundo', type: 'media', duration: 10 },
    ];
    render(<Workspace2Script blocks={blocks} onReorderBlocks={onReorderBlocks} />);
    const second = screen.getByRole('article', { name: 'Bloco 2: Segundo' });
    const first = screen.getByRole('article', { name: 'Bloco 1: Primeiro' });
    const dataTransfer = { setData: vi.fn(), getData: vi.fn(() => 'b2'), effectAllowed: '' };

    fireEvent.dragStart(second, { dataTransfer });
    fireEvent.dragOver(first, { dataTransfer });
    fireEvent.drop(first, { dataTransfer });

    expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-workspace2-block', 'b2');
    expect(onReorderBlocks).toHaveBeenCalledWith('b2', 'b1');
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Workspace2Search from './Workspace2Search';

const assets = [
  { id: 1, title: 'Entrevista Prefeito', filename: 'prefeito.mov', asset_type: 'video', duration: 90, status: 'reviewed', category: 'Entrevista', icon: '🎙️', description: 'Entrevista sobre obras', program_name: 'Jornal', subjects: 'obras, cidade' },
  { id: 2, title: 'Cidade ao amanhecer', filename: 'cidade.mov', asset_type: 'image', duration: 78, status: 'indexed', category: 'B-roll', icon: '🏙️' },
];

describe('Workspace 2 search step', () => {
  it('filters assets, toggles selection and opens the script step', () => {
    const onToggle = vi.fn();
    const onPreview = vi.fn();
    const onStepChange = vi.fn();
    render(
      <Workspace2Search
        assets={assets}
        selectedAssets={[assets[1]]}
        selectedIds={[2]}
        previewAsset={assets[0]}
        onToggle={onToggle}
        onPreview={onPreview}
        onStepChange={onStepChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Nome do arquivo'), { target: { value: 'prefeito' } });
    const grid = within(screen.getByTestId('workspace2-media-grid'));
    expect(grid.getByText('Entrevista Prefeito')).toBeInTheDocument();
    expect(grid.queryByText('Cidade ao amanhecer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Entrevista Prefeito' }));
    expect(onToggle).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ao roteiro' }));
    expect(onStepChange).toHaveBeenCalledWith('script');

    fireEvent.click(screen.getByRole('button', { name: 'Metadados' }));
    expect(screen.getByText('Entrevista sobre obras')).toBeInTheDocument();
  });

  it('clears the selection and reports local media operations', () => {
    const onClearSelection = vi.fn();
    render(
      <Workspace2Search
        assets={assets}
        selectedAssets={assets}
        selectedIds={[1, 2]}
        previewAsset={assets[0]}
        onClearSelection={onClearSelection}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Transcrever' }));
    expect(screen.getByText(/Transcrição preparada localmente/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar direitos' }));
    expect(screen.getByText(/Direitos registrados/i)).toBeInTheDocument();
  });

  it('places selected media below the search results', () => {
    render(
      <Workspace2Search
        assets={assets}
        selectedAssets={[assets[0]]}
        selectedIds={[1]}
        previewAsset={assets[0]}
      />,
    );

    const selected = screen.getByText(/Mídias selecionadas para Roteiro e Timeline/);
    const results = screen.getByText(/Mídias encontradas/);
    expect(results.compareDocumentPosition(selected) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps search and media results wide while the preview occupies the right third', () => {
    render(<Workspace2Search assets={assets} previewAsset={assets[0]} />);

    const layout = screen.getByTestId('workspace2-search');
    const preview = screen.getByRole('complementary', { name: 'Preview da mídia' });
    expect(layout.style.gridTemplateColumns).toBe('220px minmax(0, 1fr) minmax(320px, 33.333%)');
    expect(layout.lastElementChild?.previousElementSibling).toBe(preview);
  });
});

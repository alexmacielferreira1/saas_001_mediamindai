import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Workspace2 from './Workspace2';

vi.mock('../../api/media', () => ({
  listMediaAssets: vi.fn().mockResolvedValue([]),
  mediaStreamUrl: (asset) => asset.stream_url,
  uploadMediaAsset: vi.fn(),
}));

describe('Workspace 2 flow', () => {
  it('opens in search and navigates through script, preview and the Timeline 2 entry', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Workspace 2' })).toBeInTheDocument();
    expect(screen.getByTestId('workspace2-search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar mídias' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Travar' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /2\s*roteiro/i }));
    expect(screen.getByTestId('workspace2-script')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /3\s*prévia/i }));
    expect(screen.getByTestId('workspace2-preview')).toBeInTheDocument();
    expect(screen.queryByText('Cortar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir Timeline' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /4\s*timeline/i }));
    expect(localStorage.getItem('mm_workspace2_timeline2_draft')).toContain('tracks');
  });

  it('saves and resets the local Workspace 2 draft', () => {
    localStorage.clear();
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar projeto' }));
    expect(localStorage.getItem('mm_workspace2_draft')).toContain('selectedIds');
    expect(screen.getByRole('status')).toHaveTextContent(/salvo localmente/i);
    fireEvent.click(screen.getByRole('button', { name: 'Resetar projeto' }));
    expect(screen.getByRole('status')).toHaveTextContent(/restaurado/i);
  });

  it('prepares the shared project and opens Timeline 2', () => {
    localStorage.clear();
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /4\s*timeline/i }));

    const saved = JSON.parse(localStorage.getItem('mm_workspace2_timeline2_draft'));
    expect(saved.name).toBe('Jornal 12h - 15/05/2026');
    expect(saved.tracks).toHaveLength(5);
  });
});

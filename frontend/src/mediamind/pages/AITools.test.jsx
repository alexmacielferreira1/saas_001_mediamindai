import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/producaoStore', () => ({ useProducaoProjetos: () => [] }));
vi.mock('../lib/creativeToolsApi', () => ({
  listCreativeDocuments: vi.fn().mockResolvedValue([]),
  createCreativeDocument: vi.fn(),
  updateCreativeDocument: vi.fn(),
  approveCreativeDocument: vi.fn(),
}));

import AITools from './AITools';

describe('AITools', () => {
  it('renders all eleven tools and opens the carousel editor', async () => {
    render(<MemoryRouter initialEntries={['/ferramentas-ia?tool=carousel']}><AITools /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Ferramentas IA' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(11);
    expect(await screen.findByRole('heading', { name: 'Carrossel IA' })).toBeInTheDocument();
    expect(screen.getByLabelText('Título do carrossel')).toBeInTheDocument();
  });

  it('shows planned tools without an execute action', async () => {
    render(<MemoryRouter initialEntries={['/ferramentas-ia?tool=ai-dubbing']}><AITools /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: /Dublagem IA/ }));
    expect(await screen.findByText('Implementação programada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /executar/i })).not.toBeInTheDocument();
  });

  it('links thumbnails to the existing real editor', async () => {
    render(<MemoryRouter initialEntries={['/ferramentas-ia?tool=thumbnails']}><AITools /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Abrir editor de Thumbnails' })).toHaveAttribute('href', '/thumbnails');
  });
});

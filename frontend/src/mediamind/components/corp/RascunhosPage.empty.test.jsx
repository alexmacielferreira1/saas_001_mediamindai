import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const addProjeto = vi.fn(() => 1);
vi.mock('../../lib/producaoStore', () => ({
  useProducaoProjetos: () => [],
  addProjeto: (...args) => addProjeto(...args),
  updateProjeto: vi.fn(),
  transicionar: vi.fn(),
  useProducaoSaveState: () => null,
  salvarProjeto: vi.fn(),
}));

import RascunhosPage from './RascunhosPage';

describe('Rascunhos em empresa sem produções', () => {
  it('oferece "Novo rascunho" no estado vazio (sem depender de exemplos)', () => {
    render(<RascunhosPage />);
    expect(screen.getByText(/Nenhum rascunho/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Novo rascunho/ }));
    expect(addProjeto).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Nova produção' }));
  });
});

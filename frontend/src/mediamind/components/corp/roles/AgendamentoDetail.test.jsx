import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { salvarProjeto, saveState } = vi.hoisted(() => ({
  salvarProjeto: vi.fn(),
  saveState: { current: null },
}));

vi.mock('../../../lib/producaoStore', () => ({
  salvarProjeto: (...args) => salvarProjeto(...args),
  transicionar: vi.fn(),
  updateProjeto: vi.fn(),
  useProducaoSaveState: () => saveState.current,
}));
vi.mock('../../thumbnails/ProjectThumbnails', () => ({ default: () => null }));

import AgendamentoDetail from './AgendamentoDetail';

const rec = { id: 5, titulo: 'Entrevista', programa: 'Jornal', episodio: 'EP 1', grav_status: 'agendada', apresentadores: [], equipe: [] };

describe('AgendamentoDetail — salvar', () => {
  beforeEach(() => {
    salvarProjeto.mockReset();
    saveState.current = null;
  });

  it('calls the real save and does not claim success before the server confirms', async () => {
    let resolve;
    salvarProjeto.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { rerender } = render(<AgendamentoDetail rec={rec} />);

    fireEvent.click(screen.getByRole('button', { name: /Salvar agendamento/ }));

    expect(salvarProjeto).toHaveBeenCalledWith(5);
    expect(await screen.findByRole('button', { name: /Salvando/ })).toBeDisabled();
    expect(screen.queryByText(/Agendamento salvo/)).toBeNull();

    saveState.current = { status: 'saved', error: null };
    resolve(true);
    rerender(<AgendamentoDetail rec={{ ...rec }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Agendamento salvo/ })).toBeEnabled());
  });

  it('shows the server failure and offers a retry instead of "salvo"', async () => {
    saveState.current = { status: 'error', error: 'A alteração não foi salva no servidor: Servidor fora' };
    salvarProjeto.mockResolvedValue(false);
    render(<AgendamentoDetail rec={rec} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Servidor fora');
    expect(screen.getByRole('button', { name: /Não salvo — tentar de novo/ })).toBeInTheDocument();
    expect(screen.queryByText(/Agendamento salvo/)).toBeNull();
  });
});

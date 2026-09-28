import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EdicaoPage from './EdicaoPage';

const { transicionar, setEtapa, projetos } = vi.hoisted(() => ({
  transicionar: vi.fn(),
  setEtapa: vi.fn(),
  projetos: [
  { id: 2, titulo: 'Projeto aguardando', programa: 'Programa B', etapa: 'aguardando_aprovacao', edicao_status: 'pronto_para_aprovacao', historico: [] },
  { id: 1, titulo: 'Projeto em edição', programa: 'Programa A', etapa: 'em_edicao', edicao_status: 'corte_fino', historico: [] },
  ],
}));

vi.mock('../../../lib/producaoStore', () => ({
  useProducaoProjetos: () => projetos,
  addProjeto: vi.fn(),
  updateProjeto: vi.fn(),
  setEtapa,
  transicionar,
}));
vi.mock('../../../auth', () => ({ useAuth: () => ({ user: { name: 'Alex' } }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe('central de edição e aprovação', () => {
  beforeEach(() => { transicionar.mockClear(); setEtapa.mockClear(); });

  it('opens the requested waiting-approval lane and advances through the tracked transition', () => {
    render(<EdicaoPage initialLane="aguardando" />);

    expect(screen.getAllByText('Projeto aguardando').length).toBeGreaterThan(0);
    expect(screen.queryByText('Projeto em edição')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enviar pra aprovação/i }));
    expect(transicionar).toHaveBeenCalledWith(2, 'em_aprovacao', expect.objectContaining({ quem: 'Alex' }));
    expect(setEtapa).not.toHaveBeenCalled();
  });

  it('advances a waiting card to approval from its inline workflow button', () => {
    render(<EdicaoPage initialLane="aguardando" />);

    fireEvent.click(screen.getByRole('button', { name: 'Enviar para Em aprovação' }));
    expect(transicionar).toHaveBeenCalledWith(2, 'em_aprovacao', expect.objectContaining({ quem: 'Alex' }));
  });
});

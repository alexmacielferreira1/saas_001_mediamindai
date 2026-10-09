import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AprovacoesPage from './AprovacoesPage';

const { transicionar, setEtapa } = vi.hoisted(() => ({
  transicionar: vi.fn(),
  setEtapa: vi.fn(),
}));

vi.mock('../../../lib/producaoStore', () => ({
  useProducaoProjetos: () => [{ id: 7, titulo: 'Entrega', programa: 'Programa', episodio: 'EP1', etapa: 'em_aprovacao' }],
  moverEtapa: vi.fn(),
  transicionar,
  setEtapa,
}));
vi.mock('./AprovacaoReviewPanel', () => ({
  default: ({ project, onEnviarEditor, onAprovar }) => (
    <div>
      <button onClick={() => onEnviarEditor(project.id)}>Enviar para Alteração</button>
      <button onClick={() => onAprovar(project.id)}>Aprovar versão</button>
    </div>
  ),
}));

describe('review workflow', () => {
  beforeEach(() => { transicionar.mockClear(); setEtapa.mockClear(); });

  it('returns a rejected review to the Alteração lane', () => {
    render(<AprovacoesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para Alteração' }));
    expect(transicionar).toHaveBeenCalledWith(7, 'aguardando_aprovacao', expect.objectContaining({ obs: expect.stringMatching(/alterações/i) }));
  });

  it('moves an approved review to Finalizado', () => {
    render(<AprovacoesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar versão' }));
    expect(setEtapa).toHaveBeenCalledWith(7, 'finalizado');
  });
});

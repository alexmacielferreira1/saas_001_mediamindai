import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('shows a delivered media panel, not an editing timeline, in waiting review', () => {
    projetos.push({id:3,titulo:'Versão para revisão',etapa:'em_aprovacao',materiais:[]});
    try {
      render(<EdicaoPage initialLane="em_aprovacao" />);
      expect(screen.getByRole('combobox',{name:'Projeto aberto'})).toHaveValue('3');
      expect(screen.queryByTestId('editing-preview-timeline')).not.toBeInTheDocument();
      expect(screen.getByText('Nenhuma versão enviada.')).toBeVisible();
    } finally { projetos.pop(); }
  });

  it('filters the selector by stage and clears the open project for an empty stage', () => {
    render(<EdicaoPage initialLane="em_edicao" />);
    const selector=screen.getByRole('combobox',{name:'Projeto aberto'});
    expect(within(selector).queryByRole('option',{name:/Projeto aguardando/})).not.toBeInTheDocument();
    const stage=screen.getByRole('button',{name:/0 Para editar/i});
    expect(stage.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(stage);
    expect(selector).toHaveValue('');
    expect(screen.queryByTestId('editing-preview-timeline')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:/0 Aguardando revisão/i}));
    expect(selector).toHaveValue('');
  });

  it('starts with the project selector and a full-width preview timeline, with details hidden', () => {
    render(<EdicaoPage initialLane="em_edicao" />);
    expect(screen.getByRole('combobox', {name:'Projeto aberto'})).toHaveValue('1');
    const toggle=screen.getByRole('button',{name:'Mostrar fila e detalhes'});
    expect(toggle).toHaveAttribute('aria-expanded','false');
    expect(screen.getByTestId('editing-project-details')).not.toBeVisible();
    expect(screen.getByRole('heading', {name:'Central de edição'})).toBeVisible();
    expect(screen.getByRole('button', {name:'Nova edição'})).toBeVisible();
    fireEvent.click(toggle);
    expect(screen.getByTestId('editing-project-details')).toBeVisible();
  });

  it('does not present invented versions as real deliveries', () => {
    render(<EdicaoPage initialLane="em_edicao" />);
    expect(screen.queryByText('Primeira versão completa.')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhuma versão enviada.')).toBeInTheDocument();
  });

  it('opens the requested waiting-approval lane and advances through the tracked transition', () => {
    render(<EdicaoPage initialLane="aguardando" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar fila e detalhes' }));

    expect(screen.getAllByText('Projeto aguardando').length).toBeGreaterThan(0);
    expect(screen.queryByText('Projeto em edição')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enviar para revisão/i }));
    expect(transicionar).toHaveBeenCalledWith(2, 'em_aprovacao', expect.objectContaining({ quem: 'Alex' }));
    expect(setEtapa).not.toHaveBeenCalled();
  });

  it('advances a waiting card to approval from its inline workflow button', () => {
    render(<EdicaoPage initialLane="aguardando" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar fila e detalhes' }));

    fireEvent.click(screen.getByRole('button', { name: 'Enviar para Em revisão' }));
    expect(transicionar).toHaveBeenCalledWith(2, 'em_aprovacao', expect.objectContaining({ quem: 'Alex' }));
  });

  it('sends a project straight from editing to review', () => {
    render(<EdicaoPage initialLane="em_edicao" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar fila e detalhes' }));

    expect(screen.getByRole('button', { name: 'Alteração 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enviar para revisão/i }));
    expect(transicionar).toHaveBeenCalledWith(1, 'em_aprovacao', expect.objectContaining({ quem: 'Alex' }));
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { filter, create, projetos, updateProjeto } = vi.hoisted(() => ({ filter: vi.fn(), create: vi.fn(), projetos: [], updateProjeto: vi.fn() }));
vi.mock('@/api/base44Client', () => ({ base44: { entities: { Publicacao: { filter: (...a) => filter(...a), create: (...a) => create(...a) } } } }));
vi.mock('../../lib/producaoStore', () => ({ useProducaoProjetos: () => projetos, updateProjeto: (...a) => updateProjeto(...a) }));

import FinalizadoTimeline from './FinalizadoTimeline';

const PROJ = { id: 7, _entityId: 'srv-7', titulo: 'Episódio final', programa: 'Podcast', episodio: 'EP 4', etapa: 'finalizado', historico: [], tarefas: [] };

describe('Finalizado → Agendar publicação (B6)', () => {
  beforeEach(() => {
    filter.mockReset().mockResolvedValue([]);
    create.mockReset();
    updateProjeto.mockReset();
    projetos.length = 0;
    projetos.push({ ...PROJ });
  });

  it('registra a Publicacao no servidor e só então navega com o id real', async () => {
    create.mockResolvedValue({ id: 'pub-1', titulo: 'Episódio final' });
    const onNavigate = vi.fn();
    render(<FinalizadoTimeline onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agendar publicação' }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('publicacoes', expect.objectContaining({ id: 'pub-1', publicationId: 'pub-1', titulo: 'Episódio final' })));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Episódio final', project_id: 'srv-7', origem: 'finalizado', status: 'rascunho' }));
  });

  it('não duplica: reaproveita a publicação aberta da mesma produção', async () => {
    filter.mockResolvedValue([{ id: 'pub-9', project_id: 'srv-7', origem: 'finalizado', status: 'rascunho' }]);
    const onNavigate = vi.fn();
    render(<FinalizadoTimeline onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agendar publicação' }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('publicacoes', expect.objectContaining({ publicationId: 'pub-9' })));
    expect(create).not.toHaveBeenCalled();
  });

  it('falha no servidor mostra o erro e não navega', async () => {
    create.mockRejectedValue(new Error('Sem permissão de publicação'));
    const onNavigate = vi.fn();
    render(<FinalizadoTimeline onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agendar publicação' }));
    expect(await screen.findByText('Não foi possível registrar a publicação: Sem permissão de publicação.')).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('tarefas do checklist são gravadas no projeto (campo persistido)', () => {
    render(<FinalizadoTimeline onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Nova tarefa...'), { target: { value: 'Conferir master' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Nova tarefa...'), { key: 'Enter' });
    expect(updateProjeto).toHaveBeenCalledWith(7, { tarefas: [expect.objectContaining({ texto: 'Conferir master', feito: false })] });
  });
});

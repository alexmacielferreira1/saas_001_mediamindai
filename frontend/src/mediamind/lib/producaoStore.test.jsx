import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn();

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      ProducaoProjeto: {
        list: listMock,
        bulkCreate: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  },
}));

describe('production project store loading', () => {
  beforeEach(() => {
    vi.resetModules();
    listMock.mockReset().mockResolvedValue([]);
  });

  it('does not request protected production data merely by importing the module', async () => {
    await import('./producaoStore');
    expect(listMock).not.toHaveBeenCalled();
  });

  it('loads production data when an authenticated screen subscribes to the store', async () => {
    const store = await import('./producaoStore');
    renderHook(() => store.useProducaoProjetos());

    await waitFor(() => expect(listMock).toHaveBeenCalledWith('ordem', 200));
  });

  it('keeps linked media and editing metadata through load and save', async () => {
    listMock.mockResolvedValue([{id:'edit-source',titulo:'Master',materiais:[{id:'m1',nome:'master.mp4',url:'/master.mp4'}],edicao_status:'corte_fino',edicao_obs:'Ajustar áudio',prazo_edicao:'2026-10-20'}]);
    const store=await import('./producaoStore');
    const {result}=renderHook(()=>store.useProducaoProjetos());
    await waitFor(()=>expect(result.current.find(item=>item.id==='edit-source')?.materiais?.[0]?.url).toBe('/master.mp4'));
    const {base44}=await import('@/api/base44Client');
    base44.entities.ProducaoProjeto.update.mockResolvedValue({});
    store.updateProjeto('edit-source',{edicao_obs:'Áudio corrigido'});
    expect(base44.entities.ProducaoProjeto.update).toHaveBeenCalledWith('edit-source',expect.objectContaining({materiais:[{id:'m1',nome:'master.mp4',url:'/master.mp4'}],edicao_obs:'Áudio corrigido',edicao_status:'corte_fino',prazo_edicao:'2026-10-20'}));
  });
});

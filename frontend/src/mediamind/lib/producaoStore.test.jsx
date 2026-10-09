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
});

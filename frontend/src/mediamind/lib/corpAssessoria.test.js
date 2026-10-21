import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/httpClient';

const { lists, bulkCreate } = vi.hoisted(() => ({ lists: {}, bulkCreate: vi.fn() }));

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: new Proxy({}, {
      get: (_target, name) => ({
        list: () => (lists[name] ? lists[name]() : Promise.resolve([])),
        bulkCreate: (...args) => bulkCreate(name, ...args),
      }),
    }),
  },
}));

import { useAssessoria, useReleases } from './corpAssessoria';

const ENTITIES = ['Release', 'Clipping', 'Jornalista', 'Mencao'];
const denied = () => Promise.reject(new ApiError({ status: 403, code: 'SCREEN_ACCESS_DENIED', message: 'Esta tela não está liberada para você.' }));
const offline = () => Promise.reject(new Error('offline'));
const rowsFor = (name) => () => Promise.resolve([{ id: `${name}-1` }]);

describe('corpAssessoria com tela restrita', () => {
  beforeEach(() => {
    for (const key of Object.keys(lists)) delete lists[key];
    bulkCreate.mockReset();
  });

  it('useAssessoria esvazia as listas e marca forbidden no 403, sem semear', async () => {
    for (const name of ENTITIES) lists[name] = denied;
    const { result } = renderHook(() => useAssessoria());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.forbidden).toBe(true);
    expect(result.current.error.code).toBe('SCREEN_ACCESS_DENIED');
    expect(result.current.releases).toEqual([]);
    expect(result.current.clippings).toEqual([]);
    expect(result.current.jornalistas).toEqual([]);
    expect(result.current.mencoes).toEqual([]);
    expect(bulkCreate).not.toHaveBeenCalled();
  });

  it('useAssessoria mantém forbidden=false em falha que não é 403', async () => {
    lists.Release = offline;
    const { result } = renderHook(() => useAssessoria());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.forbidden).toBe(false);
    expect(result.current.error.message).toBe('offline');
  });

  it('reload limpa forbidden quando o acesso volta e também trata novo 403', async () => {
    lists.Release = denied;
    const { result } = renderHook(() => useAssessoria());
    await waitFor(() => expect(result.current.forbidden).toBe(true));

    for (const name of ENTITIES) lists[name] = rowsFor(name);
    await act(() => result.current.reload());
    expect(result.current.forbidden).toBe(false);
    expect(result.current.releases).toEqual([{ id: 'Release-1' }]);

    lists.Release = denied;
    await act(() => result.current.reload());
    expect(result.current.forbidden).toBe(true);
    expect(result.current.releases).toEqual([]);
  });

  it('useReleases devolve lista vazia no 403 e recupera no reload', async () => {
    lists.Release = denied;
    const { result } = renderHook(() => useReleases());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.forbidden).toBe(true);
    expect(result.current.releases).toEqual([]);

    lists.Release = rowsFor('Release');
    await act(() => result.current.reload());
    expect(result.current.forbidden).toBe(false);
    expect(result.current.releases).toEqual([{ id: 'Release-1' }]);

    lists.Release = denied;
    await act(() => result.current.reload());
    expect(result.current.forbidden).toBe(true);
    expect(result.current.releases).toEqual([]);
  });
});

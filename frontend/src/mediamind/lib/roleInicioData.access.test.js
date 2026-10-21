import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/httpClient';

const { releasesLoader } = vi.hoisted(() => ({ releasesLoader: vi.fn() }));

vi.mock('./corpAssessoria', () => ({ loadOrSeedReleases: () => releasesLoader() }));
vi.mock('./corpPublicacoes', () => ({ loadOrSeedPublicacoes: () => Promise.resolve([]) }));
vi.mock('./corpAprovacoes', () => ({ loadOrSeedAprovacoes: () => Promise.resolve([]) }));
vi.mock('./corpAgenda', () => ({ loadOrSeedAgenda: () => Promise.resolve([]) }));
vi.mock('./producaoStore', () => ({ useProducaoProjetos: () => [] }));

import { useRoleInicioData } from './roleInicioData';

describe('useRoleInicioData com tela restrita', () => {
  it('não troca o 403 da Assessoria por releases de demonstração', async () => {
    releasesLoader.mockRejectedValue(new ApiError({ status: 403, code: 'SCREEN_ACCESS_DENIED', message: 'Esta tela não está liberada para você.' }));
    const { result } = renderHook(() => useRoleInicioData('assessoria'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.tasks).toEqual([]);
    expect(result.current.data.stats[0].value).toBe(0);
  });

  it('mantém o comportamento anterior em falha que não é 403', async () => {
    releasesLoader.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useRoleInicioData('assessoria'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.tasks.length).toBeGreaterThan(0);
  });
});

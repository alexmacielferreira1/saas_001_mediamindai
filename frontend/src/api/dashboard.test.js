import { describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();
vi.mock('./httpClient', () => ({ request: (...args) => requestMock(...args) }));
import { getMyDashboard } from './dashboard';

describe('dashboard API', () => {
  it('loads the personalized dashboard for the current tenant membership', async () => {
    requestMock.mockResolvedValue({ role: 'editor', kpis: [] });
    await expect(getMyDashboard()).resolves.toEqual({ role: 'editor', kpis: [] });
    expect(requestMock).toHaveBeenCalledWith('/dashboard/me');
  });
});

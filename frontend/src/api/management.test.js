import { describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();
vi.mock('./httpClient', () => ({ request: (...args) => requestMock(...args) }));
import { getManagementOverview } from './management';

describe('management API', () => {
  it('loads the overview for the selected tenant', async () => {
    requestMock.mockResolvedValue({ publications: { published: 2 } });
    await expect(getManagementOverview()).resolves.toEqual({ publications: { published: 2 } });
    expect(requestMock).toHaveBeenCalledWith('/management/overview');
  });
});

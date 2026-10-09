import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();
vi.mock('./httpClient', () => ({ request: (...args) => requestMock(...args) }));

import { getAdminUser, listAdminActivity, listAdminUsers, suspendAdminUser } from './admin';

describe('admin API', () => {
  beforeEach(() => requestMock.mockReset());

  it('lists users with encoded filters', async () => {
    requestMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25 });
    await listAdminUsers({ search: 'Ana Souza', status: 'active', page: 2 });
    expect(requestMock).toHaveBeenCalledWith('/admin/users?search=Ana+Souza&status=active&page=2&page_size=25');
  });

  it('loads detail and sends a real suspension request', async () => {
    requestMock.mockResolvedValue({ id: 'user-1' });
    await getAdminUser('user-1');
    await suspendAdminUser('user-1', 'Afastamento temporário');
    expect(requestMock).toHaveBeenNthCalledWith(1, '/admin/users/user-1');
    expect(requestMock).toHaveBeenNthCalledWith(2, '/admin/users/user-1/suspend', {
      method: 'POST',
      body: { reason: 'Afastamento temporário' },
    });
  });

  it('loads recent administrative activity', async () => {
    requestMock.mockResolvedValue({ records: [{ id: 'audit-1' }] });
    await expect(listAdminActivity(5)).resolves.toEqual([{ id: 'audit-1' }]);
    expect(requestMock).toHaveBeenCalledWith('/records/LogAuditoria?sort=-created_date&limit=5');
  });
});

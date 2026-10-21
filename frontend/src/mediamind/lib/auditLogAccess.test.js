import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }));
vi.mock('@/api/base44Client', () => ({ base44: { entities: { LogAuditoria: { list: (...args) => listMock(...args) } } } }));

import { AUDIT_FORBIDDEN_MESSAGE, loadAuditLogs } from './auditLogAccess';

describe('loadAuditLogs', () => {
  beforeEach(() => { listMock.mockReset(); });

  it('returns the server logs, including an empty list, without demo data', async () => {
    listMock.mockResolvedValueOnce([{ id: 'a1' }]).mockResolvedValueOnce([]);
    await expect(loadAuditLogs(50)).resolves.toEqual({ logs: [{ id: 'a1' }], forbidden: false, error: '' });
    expect(listMock).toHaveBeenCalledWith('-created_date', 50);
    await expect(loadAuditLogs()).resolves.toEqual({ logs: [], forbidden: false, error: '' });
  });

  it('turns 403 into a permission state and other failures into an error', async () => {
    listMock.mockRejectedValueOnce(Object.assign(new Error('Proibido'), { status: 403 }));
    await expect(loadAuditLogs()).resolves.toEqual({ logs: [], forbidden: true, error: AUDIT_FORBIDDEN_MESSAGE });
    listMock.mockRejectedValueOnce(Object.assign(new Error('Servidor fora'), { status: 500 }));
    await expect(loadAuditLogs()).resolves.toEqual({ logs: [], forbidden: false, error: 'Servidor fora' });
  });
});

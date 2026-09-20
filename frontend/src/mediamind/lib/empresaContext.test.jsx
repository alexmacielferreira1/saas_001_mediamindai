import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmpresaProvider, useEmpresa } from './empresaContext';

const requestMock = vi.fn();

vi.mock('../../api/httpClient', () => ({
  request: (...args) => requestMock(...args),
}));

const user = {
  id: 'user-1',
  role: 'superadmin',
  selected_tenant_id: 'tenant-1',
};

const tenants = {
  tenants: [
    { id: 'tenant-1', name: 'Empresa Principal', role: 'superadmin' },
    { id: 'tenant-2', name: 'Empresa Secundária', role: 'editor' },
  ],
};

const wrapper = ({ children }) => <EmpresaProvider user={user}>{children}</EmpresaProvider>;

describe('local tenant context', () => {
  beforeEach(() => requestMock.mockReset());

  it('loads only server-authorized companies and restores the session selection', async () => {
    requestMock.mockResolvedValueOnce(tenants);
    const { result } = renderHook(() => useEmpresa(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(requestMock).toHaveBeenCalledWith('/tenants');
    expect(result.current.accessible).toEqual([
      expect.objectContaining({ id: 'tenant-1', nome: 'Empresa Principal', status: 'ativa' }),
      expect.objectContaining({ id: 'tenant-2', nome: 'Empresa Secundária', status: 'ativa' }),
    ]);
    expect(result.current.currentEmpresa.nome).toBe('Empresa Principal');
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.needsSelector).toBe(true);
  });

  it('persists a company switch in the server session', async () => {
    requestMock.mockResolvedValueOnce(tenants);
    const { result } = renderHook(() => useEmpresa(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    requestMock.mockResolvedValueOnce({ selected_tenant_id: 'tenant-2' });

    await act(() => result.current.setCurrent('tenant-2'));

    expect(requestMock).toHaveBeenLastCalledWith('/auth/session/tenant', {
      method: 'PUT',
      body: { tenant_id: 'tenant-2' },
    });
    expect(result.current.current).toBe('tenant-2');
  });

  it('uses the explicit global server context for admins', async () => {
    requestMock.mockResolvedValueOnce(tenants);
    const { result } = renderHook(() => useEmpresa(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    requestMock.mockResolvedValueOnce({ selected_tenant_id: null });

    await act(() => result.current.setCurrent('all'));

    expect(requestMock).toHaveBeenLastCalledWith('/auth/session/tenant', {
      method: 'PUT',
      body: { tenant_id: null },
    });
    expect(result.current.isGlobal).toBe(true);
  });

  it('fails closed when the tenant list is unavailable', async () => {
    requestMock.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useEmpresa(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.accessible).toEqual([]);
    expect(result.current.error).toBe('Não foi possível carregar suas empresas.');
  });

  it('keeps a non-admin with one membership scoped to that company', async () => {
    requestMock.mockResolvedValueOnce({
      tenants: [{ id: 'tenant-2', name: 'Empresa Secundária', role: 'editor' }],
    });
    const editorWrapper = ({ children }) => (
      <EmpresaProvider user={{ id: 'user-2', role: 'editor', selected_tenant_id: 'tenant-2' }}>
        {children}
      </EmpresaProvider>
    );
    const { result } = renderHook(() => useEmpresa(), { wrapper: editorWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.needsSelector).toBe(false);
    expect(result.current.isGlobal).toBe(false);
    act(() => result.current.clear());
    expect(result.current.current).toBeNull();
    expect(result.current.currentEmpresa).toBeNull();
  });

  it('fails clearly when used outside its provider', () => {
    expect(() => renderHook(() => useEmpresa())).toThrow(
      'useEmpresa deve ser usado dentro de EmpresaProvider',
    );
  });

  it('ignores a late tenant response after unmount', async () => {
    let resolveTenants;
    requestMock.mockReturnValueOnce(new Promise((resolve) => { resolveTenants = resolve; }));
    const { unmount } = renderHook(() => useEmpresa(), { wrapper });
    unmount();

    await act(async () => resolveTenants(tenants));

    expect(requestMock).toHaveBeenCalledWith('/tenants');
  });

  it('ignores a late tenant failure after unmount', async () => {
    let rejectTenants;
    requestMock.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectTenants = reject; }));
    const { unmount } = renderHook(() => useEmpresa(), { wrapper });
    unmount();

    await act(async () => rejectTenants(new Error('offline')));

    expect(requestMock).toHaveBeenCalledWith('/tenants');
  });

  it('starts without a selection when no user context is supplied', async () => {
    requestMock.mockResolvedValueOnce({ tenants: [] });
    const anonymousWrapper = ({ children }) => (
      <EmpresaProvider>{children}</EmpresaProvider>
    );
    const { result } = renderHook(() => useEmpresa(), { wrapper: anonymousWrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.current).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });

  it('restores the explicit global context for an admin session', async () => {
    requestMock.mockResolvedValueOnce({
      tenants: [{ id: 'tenant-1', name: 'Empresa Principal', role: 'admin' }],
    });
    const adminWrapper = ({ children }) => (
      <EmpresaProvider user={{ id: 'admin-1', role: 'admin', selected_tenant_id: null }}>
        {children}
      </EmpresaProvider>
    );
    const { result } = renderHook(() => useEmpresa(), { wrapper: adminWrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.current).toBe('all');
    expect(result.current.isGlobal).toBe(true);
  });
});

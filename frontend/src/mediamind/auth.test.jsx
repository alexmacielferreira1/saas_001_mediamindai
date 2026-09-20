import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/httpClient';
import { AuthProvider, mapSessionUser, useAuth } from './auth';

const requestMock = vi.fn();

vi.mock('../api/httpClient', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, request: (...args) => requestMock(...args) };
});

const session = {
  user: {
    id: 'user-1',
    email: 'alexmacielferreira@gmail.com',
    full_name: 'Alex Maciel Ferreira',
  },
  memberships: [
    { tenant_id: 'tenant-1', tenant_name: 'Empresa Principal', role: 'superadmin' },
    { tenant_id: 'tenant-2', tenant_name: 'Empresa Secundária', role: 'editor' },
  ],
  selected_tenant_id: 'tenant-1',
};

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('MediaMind local authentication', () => {
  beforeEach(() => requestMock.mockReset());

  it('maps the server session without storing a token in browser storage', () => {
    expect(mapSessionUser(session)).toEqual({
      id: 'user-1',
      email: 'alexmacielferreira@gmail.com',
      name: 'Alex Maciel Ferreira',
      role: 'superadmin',
      empresa_ids: ['tenant-1', 'tenant-2'],
    });
    expect(mapSessionUser(null)).toBeNull();
    expect(mapSessionUser({
      user: { id: 'user-2', email: 'editor@mediamind.ai', full_name: '' },
      memberships: [{ tenant_id: 'tenant-2', tenant_name: 'Empresa', role: 'editor' }],
      selected_tenant_id: 'unknown',
    })).toEqual({
      id: 'user-2',
      email: 'editor@mediamind.ai',
      name: 'editor@mediamind.ai',
      role: 'editor',
      empresa_ids: ['tenant-2'],
    });
    expect(mapSessionUser({
      user: { id: 'user-3', email: 'user@mediamind.ai', full_name: 'Usuário' },
      memberships: [],
      selected_tenant_id: null,
    }).role).toBe('user');
    expect(localStorage).toHaveLength(0);
  });

  it('fails clearly when the hook is used outside its provider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth deve ser usado dentro de AuthProvider',
    );
  });

  it('restores an authenticated cookie session on startup', async () => {
    requestMock.mockResolvedValueOnce(session);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(requestMock).toHaveBeenCalledWith('/auth/session');
    expect(result.current.user.email).toBe('alexmacielferreira@gmail.com');
  });

  it('treats an expired session as signed out without exposing an error', async () => {
    requestMock.mockRejectedValueOnce(
      new ApiError({ status: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Faça login.' }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toBeNull();
  });

  it('surfaces an unavailable backend instead of silently signing out', async () => {
    requestMock.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Não foi possível verificar sua sessão. Tente novamente.');
  });

  it('logs in and logs out through the local API', async () => {
    requestMock.mockRejectedValueOnce(
      new ApiError({ status: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Faça login.' }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    requestMock.mockResolvedValueOnce(session);
    await act(() => result.current.login('alexmacielferreira@gmail.com', 'senha-local'));
    expect(requestMock).toHaveBeenLastCalledWith('/auth/login', {
      method: 'POST',
      body: { email: 'alexmacielferreira@gmail.com', password: 'senha-local' },
    });
    expect(result.current.user.role).toBe('superadmin');

    requestMock.mockResolvedValueOnce(null);
    await act(() => result.current.logout());
    expect(requestMock).toHaveBeenLastCalledWith('/auth/logout', { method: 'POST' });
    expect(result.current.user).toBeNull();
  });

  it('clears local identity even when logout cannot reach the backend', async () => {
    requestMock.mockResolvedValueOnce(session);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    requestMock.mockRejectedValueOnce(new Error('offline'));

    let failure;
    await act(async () => {
      try {
        await result.current.logout();
      } catch (error) {
        failure = error;
      }
    });

    expect(failure).toEqual(expect.objectContaining({ message: 'offline' }));
    expect(result.current.user).toBeNull();
  });

  it('ignores a late session response after the provider is unmounted', async () => {
    let resolveSession;
    requestMock.mockReturnValueOnce(new Promise((resolve) => { resolveSession = resolve; }));
    const { unmount } = renderHook(() => useAuth(), { wrapper });
    unmount();

    await act(async () => resolveSession(session));

    expect(requestMock).toHaveBeenCalledWith('/auth/session');
  });

  it('denies role-protected screens by default', async () => {
    requestMock.mockResolvedValueOnce(session);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasScreenAccess()).toBe(true);
    expect(result.current.hasScreenAccess('producao')).toBe(true);
  });
});

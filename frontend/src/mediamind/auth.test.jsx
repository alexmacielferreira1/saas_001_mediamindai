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
  beforeEach(() => {
    requestMock.mockReset();
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it('maps the server session without storing a token in browser storage', () => {
    expect(mapSessionUser(session)).toEqual({
      id: 'user-1',
      email: 'alexmacielferreira@gmail.com',
      name: 'Alex Maciel Ferreira',
      role: 'superadmin',
      empresa_ids: ['tenant-1', 'tenant-2'],
      selected_tenant_id: 'tenant-1',
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
      selected_tenant_id: 'unknown',
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

  it('clears a stale identity when any request reports that authentication expired', async () => {
    requestMock.mockResolvedValueOnce(session);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    act(() => window.dispatchEvent(new Event('mediamind:authentication-required')));

    expect(result.current.user).toBeNull();
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

  it('allows a local-only demo role without depending on the backend', async () => {
    requestMock.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.loginDemo('alexmacielferreira@gmail.com'));

    expect(result.current.user).toEqual(expect.objectContaining({
      email: 'alexmacielferreira@gmail.com',
      role: 'superadmin',
    }));
    expect(localStorage.getItem('mm_demo_session_v1')).toContain('alexmacielferreira@gmail.com');
  });

  it.each([undefined, '   '])('rejects a demo login without an e-mail: %s', async (email) => {
    requestMock.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.loginDemo(email)).rejects.toThrow('Informe um e-mail para o acesso demo.');
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('mm_demo_session_v1')).toBeNull();
  });

  it('restores a local demo session after a page reload without calling the protected API', async () => {
    localStorage.setItem('mm_demo_session_v1', JSON.stringify({
      id: 'demo-editor',
      email: 'editor@mediamind.ai',
      name: 'Editor de vídeo',
      role: 'editor',
      empresa_ids: ['mediamind-demo'],
      selected_tenant_id: 'mediamind-demo',
    }));
    requestMock.mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toEqual(expect.objectContaining({ role: 'editor' }));
    expect(result.current.error).toBe('');
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('discards a corrupted local demo session and reports the unavailable backend', async () => {
    localStorage.setItem('mm_demo_session_v1', '{invalid-json');
    requestMock.mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(localStorage.getItem('mm_demo_session_v1')).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe('Não foi possível verificar sua sessão. Tente novamente.');
  });

  it('builds readable names for the other local demo profiles', async () => {
    requestMock.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.loginDemo('editor_video@mediamind.ai'));

    expect(result.current.user).toEqual(expect.objectContaining({
      name: 'Editor Video',
      role: 'editor_video',
    }));
  });

  it('blocks demo login when the frontend is not running in local development', async () => {
    vi.stubEnv('DEV', false);
    requestMock.mockRejectedValueOnce(
      new ApiError({ status: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Faça login.' }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.loginDemo('editor@mediamind.ai')).rejects.toThrow(
      'O acesso rápido está disponível somente no ambiente local.',
    );
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

  it('ignores a late session failure after the provider is unmounted', async () => {
    let rejectSession;
    requestMock.mockReturnValueOnce(new Promise((_, reject) => { rejectSession = reject; }));
    const { unmount } = renderHook(() => useAuth(), { wrapper });
    unmount();

    await act(async () => rejectSession(new Error('offline')));

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

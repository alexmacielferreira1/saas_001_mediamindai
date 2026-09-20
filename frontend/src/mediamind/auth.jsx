import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, request } from '../api/httpClient';
import { USER_ROLE_LABELS } from './data';
import { hasCorpAccess } from './lib/permissions';

const AuthContext = createContext(null);

export function mapSessionUser(session) {
  if (!session?.user) return null;
  const selected = session.memberships.find(
    (membership) => membership.tenant_id === session.selected_tenant_id,
  );
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.full_name || session.user.email,
    role: selected?.role || session.memberships[0]?.role || 'user',
    empresa_ids: session.memberships.map((membership) => membership.tenant_id),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    request('/auth/session')
      .then((session) => {
        if (active) setUser(mapSessionUser(session));
      })
      .catch((reason) => {
        if (active && !(reason instanceof ApiError && reason.status === 401)) {
          setError('Não foi possível verificar sua sessão. Tente novamente.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setError('');
    const session = await request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setUser(mapSessionUser(session));
  }, []);

  const logout = useCallback(async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const hasScreenAccess = useCallback(
    (tabId) => (tabId === undefined ? true : hasCorpAccess(user?.role, tabId)),
    [user?.role],
  );

  const value = useMemo(
    () => ({ user, loading, error, login, logout, hasScreenAccess, roleLabels: USER_ROLE_LABELS }),
    [user, loading, error, login, logout, hasScreenAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, request } from '../api/httpClient';
import { USER_ROLE_LABELS } from './data';
import { isLocalDemoAvailable } from './lib/demoAccess';
import { hasCorpAccess } from './lib/permissions';

const AuthContext = createContext(null);
const DEMO_SESSION_KEY = 'mm_demo_session_v1';
const DEMO_TENANT_ID = 'mediamind-demo';

function localDemoAvailable() {
  return isLocalDemoAvailable({ dev: import.meta.env.DEV, hostname: window.location.hostname });
}

function readDemoUser() {
  if (!localDemoAvailable()) return null;
  try {
    return JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || 'null');
  } catch {
    localStorage.removeItem(DEMO_SESSION_KEY);
    return null;
  }
}

function createDemoUser(email) {
  const normalized = email.trim().toLowerCase();
  const account = normalized.split('@')[0];
  const role = normalized === 'alexmacielferreira@gmail.com' ? 'superadmin' : account;
  return {
    id: `demo-${role}`,
    email: normalized,
    name: normalized === 'alexmacielferreira@gmail.com'
      ? 'Alex Maciel Ferreira'
      : account.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    role,
    empresa_ids: [DEMO_TENANT_ID],
    selected_tenant_id: DEMO_TENANT_ID,
  };
}

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
    selected_tenant_id: session.selected_tenant_id,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    function invalidateExpiredSession() {
      localStorage.removeItem(DEMO_SESSION_KEY);
      setError('');
      setUser(null);
    }
    window.addEventListener('mediamind:authentication-required', invalidateExpiredSession);
    return () => window.removeEventListener('mediamind:authentication-required', invalidateExpiredSession);
  }, []);

  useEffect(() => {
    let active = true;
    const restoredDemoUser = readDemoUser();
    if (restoredDemoUser) {
      setUser(restoredDemoUser);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    request('/auth/session')
      .then((session) => {
        if (active) {
          localStorage.removeItem(DEMO_SESSION_KEY);
          setUser(mapSessionUser(session));
        }
      })
      .catch((reason) => {
        if (!active) return;
        if (!(reason instanceof ApiError && reason.status === 401)) {
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
    localStorage.removeItem(DEMO_SESSION_KEY);
    setUser(mapSessionUser(session));
  }, []);

  const loginDemo = useCallback(async (email) => {
    if (!localDemoAvailable()) {
      throw new Error('O acesso rápido está disponível somente no ambiente local.');
    }
    if (typeof email !== 'string' || !email.trim()) {
      throw new Error('Informe um e-mail para o acesso demo.');
    }
    const demoUser = createDemoUser(email);
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(demoUser));
    setError('');
    setUser(demoUser);
    return demoUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem(DEMO_SESSION_KEY);
      setUser(null);
    }
  }, []);

  const hasScreenAccess = useCallback(
    (tabId) => (tabId === undefined ? true : hasCorpAccess(user?.role, tabId)),
    [user?.role],
  );

  const value = useMemo(
    () => ({ user, loading, error, login, loginDemo, logout, hasScreenAccess, roleLabels: USER_ROLE_LABELS }),
    [user, loading, error, login, loginDemo, logout, hasScreenAccess],
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

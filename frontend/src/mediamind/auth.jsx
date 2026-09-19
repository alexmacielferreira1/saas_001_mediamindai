import React, { createContext, useContext, useCallback, useState } from 'react';
import { useAuth as usePlatformAuth } from '@/lib/AuthContext';
import { USER_ROLE_LABELS } from './data';
import { hasCorpAccess } from './lib/permissions';

// ============================================================================
// Auth real (Base44) — delega à AuthProvider da plataforma (src/lib/AuthContext),
// que já chama base44.auth.me(). Remove os MOCK_USERS com senhas em texto do
// bundle JS. Mantém o contrato useAuth() que o resto do app consome, preservando
// a portabilidade da lógica de RBAC (permissions.js / roleCatalog.js): basta
// trocar a fonte de `cargo` se sair do Base44.
//
// Pré-requisito operacional: usuários precisam ser convidados pela plataforma
// (Authentication → invite) e ter o campo `cargo` setado. Sem cargo, um usuário
// comum (role 'user') não vê nenhuma aba do Corp (negar por padrão); admin vê tudo.
// ============================================================================

const AuthContext = createContext(null);

// Plataforma -> contrato consumido pelo app (mediamind useAuth).
function toMmUser(pu) {
  if (!pu) return null;
  return {
    id: pu.id,
    email: pu.email,
    name: pu.full_name || pu.email,
    role: pu.cargo || pu.role || 'user',
    empresa_ids: Array.isArray(pu.empresa_ids) ? pu.empresa_ids : [],
  };
}

export function AuthProvider({ children }) {
  const { user: platformUser, isLoadingAuth, logout: platformLogout } = usePlatformAuth();

  // Mock auth local (modo demo, sem autenticação da plataforma). Persiste em
  // localStorage pra sobreviver a reloads. Quando voltar pra auth real, basta
  // remover este mock e restaurar base44.auth.loginViaEmailPassword no login().
  const [mockUser, setMockUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mm_mock_user') || 'null'); } catch { return null; }
  });

  const user = platformUser ? toMmUser(platformUser) : mockUser;
  const loading = isLoadingAuth;

  // login demo: deriva o papel do e-mail (parte antes do @). superadmin/admin -> admin.
  // Não valida senha — só pra navegação por papel enquanto a auth real não entra.
  const login = useCallback(async (email /* senha ignorada no modo demo */) => {
    const local = (email.split('@')[0] || 'user').toLowerCase();
    const role = (local === 'superadmin' || local === 'admin') ? 'admin' : local;
    const u = {
      id: `mock_${role}`,
      email,
      name: role === 'admin' ? 'Administrador' : local.charAt(0).toUpperCase() + local.slice(1),
      role,
      empresa_ids: [],
    };
    localStorage.setItem('mm_mock_user', JSON.stringify(u));
    setMockUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('mm_mock_user');
    setMockUser(null);
    platformLogout(false);
  }, [platformLogout]);

  // hasScreenAccess — RBAC portátil (negar por padrão). Admin vê tudo.
  // Sem argumento mantém true (compat legado); com tabId faz a checagem real.
  const hasScreenAccess = useCallback(
    (tabId) => (tabId === undefined ? true : hasCorpAccess(user?.role, tabId)),
    [user?.role]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasScreenAccess, roleLabels: USER_ROLE_LABELS }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Fallback seguro para HMR: contexto recriado durante hot-reload perde
    // a referência do provider. Retorna estado "deslogado" em vez de crashar.
    return { user: null, loading: false, login: () => { throw new Error('Sessão expirada — recarregue a página'); }, logout: () => {}, hasScreenAccess: () => false, roleLabels: USER_ROLE_LABELS };
  }
  return ctx;
}
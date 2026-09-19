import React, { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// ============================================================================
// Contexto de empresa (multi-tenant). Define em qual empresa o usuário está
// trabalhando (ou 'all' = visão geral/todas as empresas). Regra:
//  - admin/superadmin enxerga TODAS as empresas + opção "Todas as empresas".
//  - demais usuários enxergam só as empresas em user.empresa_ids.
//  - Se há só UMA empresa acessível, entra direto (sem tela de seleção).
//  - Se há 2+, mostra a tela de seleção (EmpresaSelector) via EmpresaGate.
// O current persiste em localStorage; o switcher (Shell) chama clear() pra
// reabrir a seleção. O escopo dos dados do Corp por empresa é um passo futuro.
// ============================================================================

const Ctx = createContext(null);
const STORAGE_KEY = 'mm_current_empresa_v1';

export function EmpresaProvider({ user, children }) {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrentState] = useState(() => localStorage.getItem(STORAGE_KEY) || null);

  useEffect(() => {
    let alive = true;
    base44.entities.Empresa.list('-created_date', 200)
      .then((rows) => { if (alive) setEmpresas(rows || []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const accessible = isAdmin
    ? empresas
    : empresas.filter((e) => (user?.empresa_ids || []).includes(e.id));

  // Auto-seleciona quando há só uma empresa (entra direto, sem confirmação).
  useEffect(() => {
    if (loading || current) return;
    if (accessible.length === 1) setCurrentState(accessible[0].id);
    else if (accessible.length === 0 && isAdmin) setCurrentState('all');
  }, [loading, current, accessible, isAdmin]);

  // Limpa current se a empresa escolhida deixou de existir.
  useEffect(() => {
    if (loading || !current || current === 'all') return;
    if (!empresas.find((e) => e.id === current)) {
      setCurrentState(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [loading, current, empresas]);

  function setCurrent(id) {
    setCurrentState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }
  function clear() {
    setCurrentState(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  const currentEmpresa = current === 'all' ? null : empresas.find((e) => e.id === current) || null;
  const isGlobal = current === 'all';
  const needsSelector = accessible.length > 1;

  return (
    <Ctx.Provider value={{ empresas, accessible, current, currentEmpresa, isGlobal, setCurrent, clear, loading, needsSelector, isAdmin }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEmpresa() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return { loading: true, empresas: [], accessible: [], current: null, currentEmpresa: null, isGlobal: false, setCurrent: () => {}, clear: () => {}, needsSelector: false, isAdmin: false };
  }
  return ctx;
}
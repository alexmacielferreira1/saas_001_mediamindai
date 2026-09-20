import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { request } from '../../api/httpClient';

const Ctx = createContext(null);

function toEmpresa(tenant) {
  return {
    id: tenant.id,
    nome: tenant.name,
    descricao: tenant.name,
    status: 'ativa',
    plano: null,
    role: tenant.role,
  };
}

export function EmpresaProvider({ user, children }) {
  const initialCurrent = user?.selected_tenant_id ?? (user?.role === 'admin' || user?.role === 'superadmin' ? 'all' : null);
  const [empresas, setEmpresas] = useState([]);
  const [current, setCurrentState] = useState(initialCurrent);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    request('/tenants')
      .then((payload) => {
        if (active) setEmpresas(payload.tenants.map(toEmpresa));
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar suas empresas.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const isAdmin = empresas.some((empresa) => ['admin', 'superadmin'].includes(empresa.role));
  const accessible = empresas;

  const setCurrent = useCallback(async (id) => {
    setError('');
    const tenantId = id === 'all' ? null : id;
    await request('/auth/session/tenant', {
      method: 'PUT',
      body: { tenant_id: tenantId },
    });
    setCurrentState(id);
  }, []);

  const clear = useCallback(() => setCurrentState(null), []);
  const currentEmpresa = current === 'all' ? null : empresas.find((item) => item.id === current) || null;
  const isGlobal = current === 'all';
  const needsSelector = accessible.length > 1;

  const value = useMemo(
    () => ({
      empresas,
      accessible,
      current,
      currentEmpresa,
      isGlobal,
      setCurrent,
      clear,
      loading,
      error,
      needsSelector,
      isAdmin,
    }),
    [empresas, accessible, current, currentEmpresa, isGlobal, setCurrent, clear, loading, error, needsSelector, isAdmin],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEmpresa() {
  const context = useContext(Ctx);
  if (!context) throw new Error('useEmpresa deve ser usado dentro de EmpresaProvider');
  return context;
}

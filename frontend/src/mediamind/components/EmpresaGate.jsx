import React from 'react';
import { useEmpresa } from '../lib/empresaContext';
import EmpresaSelector from '../pages/EmpresaSelector';

// Decide se mostra a tela de seleção de empresa ou deixa o app seguir.
export default function EmpresaGate({ children }) {
  const { loading, needsSelector, current } = useEmpresa();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-sky-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (needsSelector && !current) return <EmpresaSelector />;
  return children;
}
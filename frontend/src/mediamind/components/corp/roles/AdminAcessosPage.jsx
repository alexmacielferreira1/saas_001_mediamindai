import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, UserCog } from 'lucide-react';
import { listMemberships } from '../../../../api/permissions';
import { ROLE_CATALOG } from '../../../lib/roleCatalog';
import { ALL_SUBTABS, isTotalAccess, getActiveSubtabs, toggleSubtab } from '../../../lib/roleSubtabs';
import { useAuth } from '../../../auth';
import EmployeeAccessRow from './EmployeeAccessRow';
import AcessoIAPanel from './AcessoIAPanel';

// Administração de Acessos e Telas: catálogo oficial de cargos (permissões
// padrão editáveis) + associação de funcionários a cargos + ajustes por pessoa.
export default function AdminAcessosPage() {
  const { user: currentUser } = useAuth();
  const [, setBump] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Lista memberships do tenant selecionado (admin autorizado pode listar). Mapeia para o
  // contrato do EmployeeAccessRow: role = cargo || role da plataforma.
  useEffect(() => {
    let alive = true;
    listMemberships()
      .then((rows) => {
        if (!alive) return;
        setEmployees((rows || []).map((u) => ({
          id: u.user_id,
          membershipId: u.id,
          email: u.email,
          name: u.full_name || u.email,
          role: u.role || 'user',
          permissionGroupId: u.permission_group_id,
        })));
      })
      .catch(() => { if (alive) setEmployees([]); })
      .finally(() => { if (alive) setLoadingUsers(false); });
    return () => { alive = false; };
  }, []);

  // Liga/desliga uma guia do cargo — salva direto, sem modo de edição.
  function onToggle(cargoId, entry) {
    toggleSubtab(cargoId, entry);
    setBump((n) => n + 1);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-50">
          <UserCog size={18} className="text-sky-400" /> Administração de Acessos e Telas
        </h2>
        <p className="text-sm text-slate-400">Defina o padrão de telas por cargo, associe funcionários e personalize acessos por pessoa.</p>
      </div>

      {/* Catálogo de cargos & funções */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck size={15} className="text-sky-400" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Catálogo de cargos & funções</h3>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          Cada cargo parte das guias correspondentes já acesas; as demais ficam desligadas. Ative ou desligue guias clicando nos chips — o padrão é salvo automaticamente.
        </p>
        <div className="grid gap-2 lg:grid-cols-2">
          {ROLE_CATALOG.map((c) => {
            const isAll = isTotalAccess(c.id);
            const active = isAll ? null : (getActiveSubtabs(c.id) || []);
            return (
              <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">{c.name}</p>
                    {c.description && <p className="text-[11px] text-slate-500">{c.description}</p>}
                  </div>
                  {isAll ? (
                    <span className="shrink-0 rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Acesso total</span>
                  ) : (
                    <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">{active.length} acesas</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_SUBTABS.map((g) => {
                    const ids = [g.id, ...(g.aliases || [])];
                    const on = isAll || ids.some((id) => active.includes(id));
                    return (
                      <button
                        key={g.id}
                        disabled={isAll}
                        onClick={() => onToggle(c.id, g)}
                        className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${on ? 'bg-sky-500 text-slate-950' : 'border border-slate-800 bg-slate-950/40 text-slate-500 hover:bg-slate-800'} ${isAll ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Funcionários & acessos por pessoa */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Users size={15} className="text-sky-400" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Funcionários & acessos por pessoa</h3>
        </div>
        <div className="space-y-2">
          {loadingUsers ? (
            <p className="text-sm text-slate-500">Carregando funcionários…</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum funcionário cadastrado. Convide usuários pela plataforma para gerenciar acessos.</p>
          ) : (
            employees.map((u) => (
              <EmployeeAccessRow key={u.id} user={u} isSelf={u.id === currentUser?.id} peers={employees} />
            ))
          )}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Funcionários vêm dos vínculos da empresa selecionada. A migração dos ajustes individuais de telas para o backend ainda está em andamento.</p>
      </section>

      <AcessoIAPanel />
    </div>
  );
}
